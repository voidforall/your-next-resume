# The source files

`roadmap.md` and `projection.md` are the source of truth; the HTML and PDF are renderings. The
renderers parse these files with **exact** patterns — a plausible-looking variant produces a file
that parses to nothing, and in one case parses to the *opposite* of what you meant. Copy the
grammar here literally.

Run `node scripts/check-output.mjs <output-dir>` after writing both files and before rendering.
It catches every mistake described below.

## `roadmap.md`

````markdown
---
target: Staff Machine Learning Engineer — Training Infrastructure
target_source: the posting at jd/anthropic-staff-mle.txt
window_start: 2026-09-01
window_end: 2027-02-28
generated: 2026-08-29
own_time_capacity: an hour or two a week
---

# Roadmap — Staff Machine Learning Engineer

## Note

Free prose about the plan as a whole. Optional. **Only this section is rendered as prose** —
text written anywhere else outside the structures below is silently dropped from the HTML.
Use it when the plan needs an explanation: what a constraint cost, what you assumed.

## M1 — Ship a multi-GPU training harness

- [ ] done
- **Start:** 2026-09-01
- **Due:** 2026-10-15
- **Where:** Own time
- **Deliverable:** What gets built, written or published.
- **Evidence:** github.com/<user>/fsdp-harness — README with a benchmark table
- **Depends on:** —
- **Learning:** Optional. Links or resource names.
- **Completed:** —

**Steps**

- [ ] Work through the [PyTorch FSDP tutorial](https://pytorch.org/tutorials/intermediate/FSDP_tutorial.html) end to end
  - [ ] Read the tutorial's "How FSDP Works" section and sketch the sharding diagram from memory
  - [ ] Run the tutorial's example script on a single GPU and confirm the baseline output
- [ ] Get a 4-GPU box provisioned and confirm NCCL all-reduce works
- [ ] Wrap the model in FSDP and get a training loop running without OOM
- [x] Write the benchmark harness and the README teardown

**Earns**

- `P1` · *Projects* — Built and benchmarked a multi-GPU training harness on PyTorch FSDP.
- `P2` · *Skills* — PyTorch FSDP, distributed training
````

### Milestone fields

| Field | Required | Rule |
| --- | --- | --- |
| `## M<n> — <title>` | yes | id unique and sequential; **em dash** between id and title |
| `- [ ] done` | yes | exactly this; `- [x] done` once the evidence exists |
| `Start:` / `Due:` | yes | ISO `YYYY-MM-DD`, both inside the window |
| `Where:` | yes | exactly `At work` or `Own time` — no other value |
| `Deliverable:` | yes | what gets produced |
| `Evidence:` | yes | see below |
| `Depends on:` | yes | milestone ids comma-separated, or `—` |
| `Learning:` | no | omit the line entirely if unused |
| `Completed:` | yes | ISO date or `—` |

Field lines are `- **Name:** value`. The bold, the colon **inside** the bold, and the leading
`- ` all matter. `**Steps**` and `**Earns**` (below) are separate blocks, not table rows — each
has its own heading line rather than a labelled field.

### The `**Steps**` list (optional)

```
- [ ] Text of the action item, may include [a link](https://…) or `code`.
- [x] Already done.
```

Same `[ ]`/`[x]` checkbox as the milestone's own `- [ ] done` line, one per action item, placed
after the labelled fields and before `**Earns**`. Resources — a book, a video, a public repo — are
just inline markdown inside the item's text; no separate field for them.

This is the one optional block in a milestone: omit the whole `**Steps**` heading if there are no
action items yet. A heading with zero items parsed under it fails `check-output.mjs`. A step's
text must never be exactly `done` (any casing) — that exact string, checked, is what the milestone
itself reads as done, from anywhere in the section.

#### Nested Tasks (optional, one level)

A Step can break down further into granular, roughly-hour-sized Tasks — same checkbox grammar,
indented **exactly two spaces**:

```
- [ ] Work through the FSDP tutorial end to end
  - [ ] Read the "How FSDP Works" section and sketch the sharding diagram
  - [x] Run the example script on a single GPU and confirm the baseline
```

Once a Step has Tasks, its own `[ ]`/`[x]` bracket is no longer read for meaning — the Step's
done-ness is *derived*: 100% of its Tasks done makes the Step done. A Step with zero Tasks is
unaffected by any of this and behaves exactly as above. A checkbox-looking line indented by any
amount other than exactly two spaces is a near-miss that silently fails to become a Task —
`check-output.mjs` catches it and names the Step.

Task completion (and Step completion derived from it) is a personal-progress convenience, never
Evidence — it never substitutes for, or visually resembles, the milestone's own `- [x] done` line.

### The `**Earns**` list

```
- `P1` · *Projects* — Text of the bullet.
```

Backticked id, space, **middle dot** `·`, space, *italic* section name, space, **em dash** `—`,
space, text. A hyphen instead of the em dash, or `-` instead of `·`, parses to zero bullets and
the milestone earns nothing.

Ids: `P` projected, `R` reframed, `C` carried. Unique across the whole file. Ids are **stable** —
once shown to the user, an id keeps its bullet.

### Evidence

Something a person could check. Public artifacts are the strongest: a repo, a merged pull
request, a published post, a certification id, a deployed URL.

**Internal work counts** when it is named precisely enough that a colleague could confirm it and
a hiring manager could ask about it: "named owner in the service catalogue", "design doc reviewed
by the platform team", "the runbook for this rota". Most milestones should be `At work`, so most
evidence will be internal — that is expected, not a compromise.

"Learned X", "got more familiar with Y", "studied Z" are never evidence.

## `## Reachability` — only when the target is out of reach

Out of reach means: **any** requirement lands in "needs a different job first", **or** the
target's headline requirement — the one the posting leads with — lands in "needs longer".

Then frontmatter also carries:

```yaml
target: <the role reachable in this window>
ultimate_target: <the role they actually named>
next_hop_horizon: roughly eighteen months beyond this window
```

and the body carries this section. **The three `###` headings must be exactly these strings:**

````markdown
## Reachability

### Closeable in this window
- A requirement, and one line on how this plan closes it.

### Needs longer
- A requirement, and why the window is not enough.

### Needs a different job first
- A requirement that cannot be earned from where they sit now.
````

Not "Closeable", not "Longer". A heading the parser does not recognise sorts last, which silently
puts "Needs a different job first" **first** and drops the unrecognised class into the green card.
`check-output.mjs` rejects it.

A reachable target has no `## Reachability` section, no `ultimate_target` and no
`next_hop_horizon`. Never score readiness out of 100.

## `projection.md`

````markdown
---
name: Jane Doe
headline: Machine Learning Engineer — Distributed Training
headline_was: Senior Backend Engineer
contact: jane@example.com · github.com/janedoe
---

## Experience — Acme, Senior ML Engineer, 2023–present

- `C1` — Owned the feature store serving 40M daily inferences.
- `R2` — Led the migration of training pipelines to Kubernetes, cutting setup from days to hours.
  - **Was:** Moved our training pipelines onto Kubernetes.

## Projects

## Skills
````

Carried and reframed bullets only — **no `P` ids in this file.** Projected bullets live inside the
milestone that earns them; that is what makes an unearned bullet impossible to write.

Bullet lines are `` - `<id>` — <text> `` with an em dash. Every `R` bullet carries a `- **Was:**`
line beneath it holding the wording it replaced. `headline_was:` does the same job for the headline,
which has no bullet to hang a `Was:` on.

Empty sections are legal and expected — they are the landing places projected bullets name. A
projected bullet's `*Section*` must match a `##` heading here, exactly or by prefix
(`Experience — Acme` matches `Experience — Acme, Senior ML Engineer, 2023–present`).
