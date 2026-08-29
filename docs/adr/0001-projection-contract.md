# 1. The projection contract

Date: 2026-08-29
Status: Accepted
Ticket: [#3](https://github.com/voidforall/your-next-resume/issues/3)

## Context

The product's central artifact is a resume describing experience the user does not yet have. Without a contract governing what may be invented, `your-next-resume` is a fabricated-resume generator. The contract is what makes the Roadmap the point of the tool rather than a bonus feature.

Terms used here are defined in [CONTEXT.md](../../CONTEXT.md).

## Decision

**1. Only earnable evidence may be projected.** Projectable: skills, self-shipped artifacts (projects, open-source contributions, writing, talks), certifications, outcomes measurable from those artifacts, and continued tenure at the current employer with dates extended. Never projectable: a new title, a new employer, a promotion, headcount, compensation, degrees, or achievements attributable to a company the user does not work at. The test is whether the user could make it true by themselves inside the window.

**2. Every Projected Bullet traces to at least one Milestone, and every Milestone names its Evidence.** Evidence is third-party-checkable: a repo, a merged PR, a published post, a certification id, a deployed URL. Many-to-many linking is allowed. A bullet no Milestone earns is deleted, not softened.

**3. Milestones that depend on someone else's decision get no special treatment.** A merged pull request, an accepted talk, a manager-assigned project are recorded like any other Milestone. Consequence, accepted knowingly: a Projected Bullet can rest on an outcome the user does not fully control, and the projection is honest about being a projection rather than about being certain. The Evidence rule still bites — the bullet becomes true only when the Evidence exists.

**4. Existing content may be reframed, and reframes are marked.** A Reframed Bullet may change wording, emphasis and order to speak the Target's language, and may never add a fact, metric, technology or scope not already present. It is rendered distinctly from a Projected Bullet, so the diptych shows two honest change classes: same truth said better, and new truth still to be earned.

**5. The Stamp is layered.** A header band beneath the name (wording settled in [ADR 0003](0003-projection-visual-language.md): "PROJECTED STATE · \<date\> — EARNED ONLY IF THE ROADMAP IS COMPLETED", with "Not a record of experience" right-aligned), per-bullet marks for Projected and Reframed content, and the same statement in the PDF Title/Subject metadata. Nothing survives a determined PDF editor; the goal is that removing the Stamp is deliberate rather than accidental, so the artifact cannot be innocently mistaken for a real resume.

**6. The refusal line is narrow.** The skill declines exactly four requests: remove or weaken the Stamp; present projected content as completed experience; backdate a Milestone; write experience at an employer the user has not worked for. Everything else generates. A refusal offers the two real alternatives — an honest present-day resume, or a shorter window with fewer Projected Bullets.

## Consequences

- The Roadmap is load-bearing: generation order runs roadmap first, then the Projection derived from it. A Projection cannot be produced before the Milestones that justify it exist.
- `roadmap.md` must carry, per Milestone, the Evidence and the identifiers of the bullets it earns ([#7](https://github.com/voidforall/your-next-resume/issues/7)).
- The resume template needs three distinct bullet styles — carried, reframed, projected — plus the Stamp band ([#8](https://github.com/voidforall/your-next-resume/issues/8)).
- Refusal wording belongs in the skill's conversation design ([#12](https://github.com/voidforall/your-next-resume/issues/12)).
- Decision 3 leaves a known gap: at-risk Milestones are indistinguishable from certain ones. If it bites, the fix is a dependency marker on the Milestone, which the schema should not preclude.
