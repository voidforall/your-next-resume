# 9. Resume intake

Date: 2026-08-29
Status: Accepted
Ticket: [#6](https://github.com/voidforall/your-next-resume/issues/6)

## Context

Everything downstream is built on the text of the Current Resume. No text-extraction tool is safe to assume: `pdftotext` is not system software (on the development machine it came from miniconda), `textutil` is macOS-only, and `pandoc` and LibreOffice are absent by default. [ADR 0005](0005-node-runtime-dependency.md) already guarantees Node.

## Decision

### The ladder

| Input | How it is read |
| --- | --- |
| PDF | The host agent reads the file itself — Claude Code reads PDFs natively. Falls back to `pdftotext` if it happens to be installed, then to asking the user to paste. |
| DOCX | A shipped Node extractor: a DOCX is a zip and `zlib.inflateRawSync` is enough, so no dependency. Falls back to macOS `textutil`, then to paste. |
| MD / TXT | Read directly. |
| LinkedIn PDF export | Same path as PDF. |

The agent is a capable parser we would otherwise not be using; where it can read the file, that is the shortest reliable path.

### The parse is always confirmed

After reading, the skill writes `projection.md` with the Carried Bullets and shows it: *this is what I read — correct anything wrong before I plan against it.* One round trip, and it catches every garbled two-column or design-heavy PDF. The artifact is one the user owns and will edit later anyway.

### The parsed form is `projection.md` itself

There is no separate intermediate structure. Intake produces the [ADR 0002](0002-roadmap-schema.md) `projection.md`, sections and carried bullets, ready for reframing and for milestones to target.

### No resume

A short interview, about five questions: current role and employer, how long, two or three things they actually did, education or certifications if relevant, current skills. It produces a thin but honest `projection.md`, which the same confirmation step then corrects. It is not a guided resume-writing product.

## Consequences

- One build ticket: the DOCX extractor ([#22](https://github.com/voidforall/your-next-resume/issues/22)). The rest of the ladder is SKILL.md instruction, not code.
- The confirmation step is the first artifact the user sees, so it lands before the roadmap in the run order — a sequencing constraint on [#12](https://github.com/voidforall/your-next-resume/issues/12).
- A user who pastes text gets the same confirmation, so the path is uniform.
