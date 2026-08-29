# 7. Repo shape, licence and CI

Date: 2026-08-29
Status: Accepted
Ticket: [#11](https://github.com/voidforall/your-next-resume/issues/11)

## Context

[ADR 0006](0006-distribution.md) removed the npm package, the `bin/` and the marketplace manifest, so what remains is a repository the `skills` CLI can read.

## Decision

```
skills/your-next-resume/     the skill — SKILL.md, references/, scripts/, assets/
docs/adr/  docs/research/    decisions and their evidence
fixtures/alex-moreau/        synthetic demo persona; CI input and public demo
spikes/                      throwaway prototypes, kept as primary sources
tools/                       validate.mjs, render-check.sh
CONTEXT.md  README.md  LICENSE
```

The skill sits at `skills/<name>/SKILL.md` — the conventional home the ecosystem CLI finds by walking the tree — rather than at the repo root, so docs, fixtures and spikes are not shipped to installers and a second skill could be added later.

`set-pdf-metadata.mjs` has moved from the spike into `skills/your-next-resume/scripts/`, as ADR 0005 anticipated. The spike's `FINDINGS.md` now links to its new home.

**Licence: MIT.** The default in this ecosystem; licence friction is pure downside for something meant to be widely adopted.

**CI runs on every push and PR:**

- `validate` — `tools/validate.mjs`, zero dependencies, checks SKILL.md frontmatter (name rules, directory match, reserved words, length caps) and the fixture against the ADR 0002 schema: required milestone fields, dates inside the window, resolvable dependencies, unique bullet ids, projected bullets targeting sections that exist, and a `Was:` line on every reframed bullet. It also runs `skills-ref validate` as a soft check — a third-party 0.1.x tool gives useful signal but should not gate the build.
- `render` — `tools/render-check.sh` renders the page with headless Chrome and asserts A4, at least one page, the stamp's condition *and* negation present in the PDF text layer, the reframe's original wording preserved, and a plausible file size. It points at the diptych prototype today and moves to the real template when one exists.

The render check exists because the #5 spike showed these failures are **silent**: a dropped `print-color-adjust` leaves white text on white paper with the stamp still in the text layer.

## Consequences

- A malformed `SKILL.md` would make the repo look empty to the installer rather than erroring, so `validate` is release-critical, not hygiene.
- The fixture is load-bearing twice over — CI input and the public demo persona — so changes to it are changes to the demo.
