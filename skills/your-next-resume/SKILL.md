---
name: your-next-resume
description: Projects a resume forward to a target job — writes a milestone roadmap, then a stamped future-state resume PDF where every invented line traces to a dated milestone that earns it, plus an offline HTML roadmap and a present-day resume you can send today. Use this whenever someone shares a resume or CV and a job they want, asks what their resume could look like in six months or a year, wants a career roadmap or learning plan aimed at a specific role, asks how to close the gap to a job description, or wants help planning a career move — even if they do not use the words "projection" or "roadmap".
license: MIT
compatibility: Requires Node 18+ and a Chrome-family browser (Chrome, Chromium or Edge) for PDF output. Runs fully offline.
metadata:
  repository: https://github.com/voidforall/your-next-resume
---

# your-next-resume

Take someone's resume and a job they want, and produce the resume they could honestly have by a chosen date — alongside the plan that earns it.

The rule that makes this legitimate rather than fabrication: **no line appears on the projection unless a milestone earns it.** The roadmap is not a bonus feature; it is what makes the projection a claim someone can pay off rather than a lie.

**Read [`references/projection-contract.md`](references/projection-contract.md) before generating anything.** It holds the operative rules — what may be projected, what may never be, how reframes work, the refusals. This file is the procedure; that file is the contract.

## The run

Work in `./your-next-resume/` in the user's working directory. If that folder already exists, say so and ask whether to regenerate from scratch or re-render from the markdown already there — people are invited to hand-edit `roadmap.md`, and silently overwriting that work would punish exactly the behaviour this design asks for.

### 1. Ask for two things

The resume, and the target job. Nothing else yet — two questions is the whole cost of admission, and everything after this shows them something.

For the target, a real job description is much better than a job title: paste, a file, or a URL. If they have none, take role + level + company archetype and interview briefly for the rest.

### 2. Read the resume

Use the ladder in the contract: read the file yourself where you can (PDF included), `node "$S/scripts/docx-to-text.mjs" <file.docx>` for DOCX (see step 7 for `$S`), direct read for Markdown and text, pasted text as the last resort.

Write `your-next-resume/projection.md` with the sections and the carried bullets — this file *is* the parsed form, not an intermediate on the way to one.

With no resume at all, interview: current role and employer, how long, two or three things they actually did, education or certifications if relevant, current skills. Five questions, not fifty.

### 3. Checkpoint — confirm what you read

Show them the file. *This is what I have; correct anything wrong before I plan against it.*

Two-column and design-heavy PDFs read back garbled, and everything downstream is built on this text. A silent misread poisons the roadmap and the projection together, so this checkpoint is not optional.

### 4. Ask the window and the capacity

The window, defaulting to six months. Then: roughly how much time outside work, if any — none, an hour or two a week, evenings and weekends. **This question is skippable and must feel skippable.** It lands here rather than up front because it is the personal one, and it reads very differently once the tool has already done something real.

### 5. Judge reachability, then write the roadmap

Classify every requirement the target names as **closeable** in the window, **longer**, or **needs a different job first**. If any land in the third class, or too many in the second, plan two hops — see the contract. Never score readiness out of 100.

Write `your-next-resume/roadmap.md` in the schema the contract describes. What matters most:

- **Prefer work doable inside their current job.** Scope taken at work, an internal migration, documentation, mentoring, an internal talk, taking ownership of a service. This is better career advice than a weekend project — work done at work is higher-signal and more verifiable — and it does not quietly assume free evenings.
- **Label every milestone** `Where: At work` or `Where: Own time`, and respect the capacity they gave.
- **Name evidence, not activity.** "Learned Rust" is not evidence. "Public repo with benchmarks, here" is.
- **Every milestone earns at least one bullet**, written inside the milestone with a stable id.

### 6. Checkpoint — approve the roadmap

Show it and ask. If the plan proposes work they will not do, every bullet it earns is worthless — and that is far cheaper to discover as markdown than as a rendered PDF.

If you planned two hops, this is where you say so, and where you offer to project against the original target anyway if they would rather. If they take that offer, keep the reachability assessment on the page.

### 7. Render

The scripts sit in `scripts/` **next to this file**, wherever the skill is installed — commonly
`~/.claude/skills/your-next-resume/`. Set `S` to that directory once and use it throughout, rather
than assuming a path:

```bash
S=<the directory containing this SKILL.md>
OUT=your-next-resume

node "$S/scripts/render-roadmap.mjs"    "$OUT/roadmap.md" "$OUT/roadmap.html" --projection "$OUT/projection.md"
node "$S/scripts/render-projection.mjs" "$OUT/projection.html"                --source "$OUT"
node "$S/scripts/render-projection.mjs" "$OUT/resume-today.html" --mode today --source "$OUT"
node "$S/scripts/render-pdf.mjs"        "$OUT/projection.html"   "$OUT/projection.pdf"
node "$S/scripts/render-pdf.mjs"        "$OUT/resume-today.html" "$OUT/resume-today.pdf"
```

The scripts own the hard parts — print CSS, the stamp, the browser probe, the PDF metadata. Do not hand-write HTML for these documents; the invariants they enforce fail silently when you get them wrong.

If no browser is found, `render-pdf.mjs` explains how to print the HTML by hand. If it reports that metadata could not be written, the documents are still correct — say so plainly and move on.

### 8. Close

Name the seven files and where they are. Say which is submittable today (`resume-today.pdf` — everything in it is true) and which is not (`projection.pdf` — a projection, stamped). Say that the roadmap is what makes the projection true. Give one next action: open `roadmap.html` and start the first milestone.

Do not congratulate. Nothing has been achieved yet — that is the entire point of the artifact.

## The three kinds of line

| Kind | Meaning | On the page |
| --- | --- | --- |
| Carried | true today, unchanged | plain |
| Reframed | true today, reworded for the target | `~`, amber, with its `Was:` line |
| Projected | not true yet | `+`, green, tagged with the earning milestone's month |

A reframe may change wording, emphasis and order. It may **never** add a fact, a metric, a technology or a scope that was not already there. Keep the original wording in the `Was:` line — the diptych cannot show a reframe honestly without it.

## Refusals

Decline these four, in a sentence, without a lecture:

- remove or weaken the stamp
- present projected content as completed experience
- backdate a milestone
- write experience at an employer they have not worked for

Then offer the two things you can do instead: an honest present-day resume, or a shorter window with fewer projected bullets. The first one already exists — `resume-today.pdf` — so the offer is real.

## When something goes wrong

- **The resume read back as nonsense.** Say so before planning. Ask them to paste the text instead.
- **The target is a job title with no detail.** Ask for the posting. If they have none, say what you are assuming about the role and let them correct it.
- **Nothing is projectable.** If the honest answer is that the target needs a different job first, say that and plan the hop that gets them there. This is not failure; it is the tool working.
