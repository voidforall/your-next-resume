# 4. The roadmap page

Date: 2026-08-29
Status: Accepted
Ticket: [#9](https://github.com/voidforall/your-next-resume/issues/9)
Prototype: [`spikes/roadmap-html/roadmap.prototype.html`](../../spikes/roadmap-html/roadmap.prototype.html) — throwaway; three layouts via `?variant=`, rendered from a 12-milestone dataset shaped as ADR 0002

## Context

The roadmap page is the second half of the deliverable and the half that carries the argument: it is what makes a Projected Bullet legitimate. It must be one offline file, render from `roadmap.md`, and stay readable at twelve milestones.

## Decision

### Two views in one file

**Timeline is the default**; a toggle switches to **By resume line**. Timeline answers *when*; the by-resume-line view answers *why am I doing this*, showing each Projected or Reframed Bullet with the Milestones that buy it. The toggle is a few lines and the file stays self-contained.

Rejected: **Now / Next / Later** — most actionable day to day, but it hides the calendar shape and "Later" becomes a dumping ground (6 of 12 in the prototype).

### Milestone card

Checkbox · `M<n>` id · title · due date, then labelled rows for **Deliverable**, **Evidence**, **After** (only when it has dependencies) and **Learning** (only when present), then the **Earns** block: a tinted panel listing each bullet by id, text and target section. Green when it earns Projected Bullets, amber when Reframed — the ADR 0003 palette, so a bullet carries the same colour on both artifacts.

### Progress and the honesty note

A progress meter reads "n of 12 done". Directly beneath it, permanently:

> **Ticks live in this browser only.** They are a convenience — they are not saved to `roadmap.md` and they will not follow you to another device. The file on your machine is the record: set `- [x]` and fill `Completed:` there.

ADR 0002 made the file the source of truth. The page must say so rather than let a tick imply a save it cannot perform.

### Section order in the by-resume-line view

Sections follow the resume's own order, read from `projection.md` when it is available — named with `--projection`, or found beside the roadmap. `Header` leads, since that is where it sits on the resume; sections the projection does not define keep due-date order at the end. Without `projection.md` the whole view falls back to due-date order.

### Print and density

Prints to A4; twelve milestones came to four pages. Checkboxes render as empty squares so a printed roadmap is tickable by hand. The timeline groups by month divider, which is what keeps a long roadmap navigable — the density limit is the number of milestones a person will act on, not a layout limit.

## Consequences

- The renderer needs milestones *and* their earned bullets in one pass; the by-resume-line view inverts the same data, so both views build from one structure.
- A milestone earning two bullets appears once in the timeline and twice in the by-resume-line view. Accepted: in that view the bullet is the subject.
- No network, no fonts, no libraries — the page must open from a `file://` URL forever.
