# 12. The present-day resume

Date: 2026-08-29
Status: Accepted
Ticket: [#15](https://github.com/voidforall/your-next-resume/issues/15)

## Context

[ADR 0001](0001-projection-contract.md) allows existing content to be **reframed** — reworded to speak the target's language without adding a fact. That makes a third document exist implicitly, distinct from both diptych panels:

| Document | Contents |
| --- | --- |
| Diptych, left panel | carried bullets, reframes **reverted** — the resume as written |
| Diptych, right panel | carried + reframed + projected, stamped |
| **The present-day resume** | carried + reframed, **no projections** — everything true, retuned |

ADR 0001's refusal path offers "an honest present-day resume" as an alternative. Without this document that offer is empty.

## Decision

**Every run also writes `resume-today.pdf`.** Everything in it is true, so it carries **no stamp and no marks** — it is submittable this afternoon. `render-projection.mjs --mode today` emits it as a single-page document; `render-pdf.mjs` renders it.

It is the half of the value that is real today, and it means a run delivers something usable even for someone who never touches the roadmap.

### The metadata must not lie in either direction

`render-pdf.mjs` writes the projection statement into `/Info` only for a page that actually carries the Stamp band. Claiming "PROJECTION. Not a record of experience" on a document where everything is true would be a false mark in the opposite direction — caught in review, and now asserted in CI.

## Consequences

- Output is seven files, not five ([ADR 0010](0010-the-run.md)) — the present-day resume has an HTML and a PDF, like the projection; the closing message names which is submittable now and which is not.
- `tools/render-check.sh` now renders **both** documents through the shipped pipeline and asserts in both directions: the projection carries the stamp visibly and in `/Info`; the present-day resume carries neither, and no projected bullet leaks into it. Negative-tested. This also completes the handover [#20](https://github.com/voidforall/your-next-resume/issues/20) left open — CI exercises the real templates rather than the prototype.
