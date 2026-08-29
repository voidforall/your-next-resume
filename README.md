# your-next-resume

Imagine your resume six months from now — and get the roadmap that earns it.

> **Under construction.** The design is settled and recorded; the skill itself is not implemented yet.
> Installing today gets you a stub. Progress lives on [the map](https://github.com/voidforall/your-next-resume/issues/1).

An agent skill that takes your resume and a job you want, then produces two things:

- a **projection** — your resume as it could read at the end of the window, as a PDF, where every
  invented line is marked and dated;
- a **roadmap** — an offline HTML page of dated milestones, where each one names the evidence it
  produces and the resume line it earns.

No line appears on the projection unless a milestone earns it. That rule is the whole product:
the projection is a claim, and the roadmap is what makes the claim payable.

## Install

```
npx skills add voidforall/your-next-resume
```

Requires Node 18+ and a Chrome-family browser for PDF output. Runs fully offline — your resume
never leaves your machine.

## Repository

| Path | What's in it |
| --- | --- |
| `skills/your-next-resume/` | the skill: `SKILL.md`, `references/`, `scripts/`, `assets/` |
| `docs/adr/` | the decisions, with their reasoning |
| `docs/research/` | prior art, and how skills are packaged and installed |
| `fixtures/alex-moreau/` | the synthetic demo persona, used as CI input |
| `spikes/` | throwaway prototypes kept as primary sources |
| `tools/` | `validate.mjs`, `render-check.sh` — what CI runs |

`CONTEXT.md` holds the vocabulary. Start there, then read the ADRs in order.

## Licence

MIT
