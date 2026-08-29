# The projection contract

Operative rules, distilled from ADR 0001–0004. Full reasoning lives in the repo's `docs/adr/`.

## Vocabulary

- **Current Resume** — the true document the user supplies. Never modified in place.
- **Target** — the job aimed at; a real job description where possible.
- **Projection Window** — the span covered, 6 months by default.
- **Projection** — the output resume as of the end of the window. Always carries the Stamp.
- **Carried / Reframed / Projected Bullet** — true today and unchanged / true today and reworded / not true yet.
- **Milestone** — one unit of work; **Evidence** — the third-party-checkable artifact it produces.

## Hard rules

1. **Generate the roadmap first.** A Projection may not be produced before the milestones that justify it exist.
2. **No milestone, no projected bullet.** A projected bullet exists only if at least one milestone earns it. If nothing earns it, delete it — do not soften it.
3. **Evidence must be checkable.** A repo, a merged PR, a published post, a certification id, a deployed URL. "Learned X" is not evidence; "shipped X, here" is.
4. **Projectable:** skills, self-shipped artifacts (projects, open-source contributions, writing, talks), certifications, outcomes measurable from those artifacts, and continued tenure at the *current* employer with dates extended.
   **Never projectable:** a new title, a new employer, a promotion, headcount or reports, compensation, degrees, or any achievement attributable to a company the user does not work at.
   The test: *could the user make this true by themselves, inside the window?*
5. **A reframe may not add a fact.** Wording, emphasis and order may change. A new metric, technology or scope may not appear. Every reframed bullet keeps its original text in a `Was:` line.
6. **Prefer work doable inside the user's current job.** Look for milestones sourced from work hours — scope taken at work, an internal migration, docs, mentoring, an internal talk — before proposing evening projects. Label every milestone `Where: At work` or `Where: Own time`, and respect the capacity the user gave at intake when deciding how many own-time milestones to propose.
7. **The Stamp is layered** — header band, per-bullet marks, and PDF metadata. Never omit a layer that the environment can support.

## The run

1. Ask for the resume and the target job. 2. Read it and write `./your-next-resume/projection.md`. 3. **Show it and invite correction.** 4. Ask the window and the outside-hours capacity. 5. Generate `roadmap.md`. 6. **Show it and get approval.** 7. Render bullets, both HTML pages and the PDF. 8. Close with the files, the caveat, and one next action.

Also render the **present-day resume** (`render-projection.mjs --mode today`): carried + reframed, no projections, no stamp — everything in it is true and it is submittable now ([ADR 0012](../../../docs/adr/0012-present-day-resume.md)).

All output goes to `./your-next-resume/`. If that folder exists, ask before regenerating — never silently overwrite a hand-edited `roadmap.md`. Full sequence: [ADR 0010](../../../docs/adr/0010-the-run.md).

## Intake

Read the Current Resume by the ladder in [ADR 0009](../../../docs/adr/0009-resume-intake.md): agent reads the file where it can, `scripts/docx-to-text.mjs` for DOCX, direct read for MD/TXT, paste as the last resort. Then **always** write `projection.md` and show it back for correction before planning anything against it. No resume: a short interview, about five questions, producing the same file.

## When the target is out of reach

Classify every requirement the target names as **closeable** in the window, **longer**, or **needs a different job first**. Any requirement in the third class — or too many in the second — means out of reach. Then plan **two hops**: project to the role reachable inside the window, and name the real target as the next hop with a rough horizon. Never score readiness out of 100.

If the user overrides, generate against the original target but keep the gap classification on the roadmap page. Full rule: [ADR 0011](../../../docs/adr/0011-reachability.md).

## Refusals

Decline exactly these, and offer instead an honest present-day resume or a shorter window:

- remove or weaken the Stamp
- present projected content as completed experience
- backdate a milestone
- write experience at an employer the user has not worked for

## Rendering invariants

- `print-color-adjust: exact` on the stamp band **and** every tinted row, or the stamp silently vanishes into white-on-white under Cmd+P.
- No remote web fonts: renders are non-deterministic and variable axes degrade to Type 3.
- Render with `--headless --no-pdf-header-footer --print-to-pdf`; `@page { size: A4; margin: 14mm 15mm 16mm }`.
- Chrome cannot write PDF metadata; run `scripts/set-pdf-metadata.mjs` afterwards. If Node is absent, ship the PDF anyway and say the metadata layer is missing.
