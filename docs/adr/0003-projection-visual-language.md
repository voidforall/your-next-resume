# 3. The projection visual language

Date: 2026-08-29
Status: Accepted
Ticket: [#8](https://github.com/voidforall/your-next-resume/issues/8)
Prototype: [`spikes/resume-diptych/diptych.prototype.html`](../../spikes/resume-diptych/diptych.prototype.html) — throwaway; three treatments switchable via `?variant=`

## Context

ADR 0001 requires three visually distinct kinds of line (Carried, Reframed, Projected) and a layered Stamp. ADR 0002 gives every bullet a stable id and every Reframed Bullet a `Was:` line. The hero moment is the before/after diptych. Three treatments were built against a synthetic persona and compared as rendered PDFs and screenshots.

## Decision

### Diff treatment

Projected and Reframed bullets are rendered as a code diff:

| Kind | Gutter | Row | Tag |
| --- | --- | --- | --- |
| Carried | none | plain paper | none |
| Reframed | `~` | amber tint, `Was:` line beneath in italic | `REFRAMED` |
| Projected | `+` | green tint | `PROJECTED · <month year>` from the earning Milestone's `Due:` |

Rejected: **Ledger** (coloured rules and dated chips) — the most resume-like, and therefore the easiest to mistake for a real document; **Blueprint** (superscript `M1` citations resolving to an evidence block) — the most rigorous but reads academic, and the citations vanish at screenshot size.

The diff reads as before/after with no caption, is native to the audience, and is the *least* submittable-looking of the three. That last property is a feature: ADR 0001 wants a document that cannot be innocently mistaken for a record of experience.

### The Stamp band

```
PROJECTED STATE · 28 FEB 2027 — EARNED ONLY IF THE ROADMAP IS COMPLETED    Not a record of experience
```

Full-bleed dark band directly beneath the name block, target date on the left, the negation right-aligned and never wrapping. The left half names the condition rather than merely disclaiming, which is the product's thesis: the projection is true only if the work is done.

### Diptych and print

Current Resume left, Projection right, same page geometry. The shareable image is the whole two-panel view. Printing emits **only** the Projection panel, which is the shipped PDF.

### Print constraints, from the #5 spike

- `-webkit-print-color-adjust: exact` and `print-color-adjust: exact` on the Stamp band **and** every tinted row. Without it the Cmd+P fallback silently drops the tints, taking the diff treatment and the band's background with them.
- No remote web fonts. System stacks only: a serif for body, a sans for metadata, monospace for the diff gutters.
- `@page { size: A4; margin: 14mm 15mm 16mm }`, `break-inside: avoid` on `li`, `break-after: avoid` on `h2`.
- Render with `--headless --no-pdf-header-footer --print-to-pdf`.

## Consequences

- The tag text on a projected bullet is derived from its Milestone's `Due:` date, so the resume renderer needs the milestone, not just the bullet — the ids in ADR 0002 carry that link.
- The diff tints are load-bearing for meaning, not decoration. Any future "clean print" mode would strip meaning and needs its own decision.
- The roadmap HTML (#9) should share this palette: green for projected, amber for reframed.
