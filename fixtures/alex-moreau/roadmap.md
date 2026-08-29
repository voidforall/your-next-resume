---
target: Staff Machine Learning Engineer — Training Infrastructure
target_source: fixtures/alex-moreau/target-jd.txt
window_start: 2026-09-01
window_end: 2027-02-28
generated: 2026-08-29
own_time_capacity: evenings and weekends
---

# Roadmap — Staff Machine Learning Engineer

## M1 — Ship a multi-GPU training harness

- [ ] done
- **Start:** 2026-09-01
- **Due:** 2026-10-15
- **Where:** Own time
- **Deliverable:** Public repo training a small LM across 4 GPUs with FSDP, benchmarks and a written teardown.
- **Evidence:** `github.com/amoreau/fsdp-harness` — README with benchmark table
- **Depends on:** —
- **Learning:** PyTorch FSDP tutorial · ZeRO paper
- **Completed:** —

**Earns**

- `P1` · *Projects* — Built and benchmarked a multi-GPU training harness on PyTorch FSDP, cutting step time 2.1× over the naive baseline.
- `P2` · *Skills* — PyTorch FSDP, distributed training

## M2 — Reframe the Kubernetes migration with real numbers

- [ ] done
- **Start:** 2026-09-01
- **Due:** 2026-09-12
- **Where:** At work
- **Deliverable:** Pull the actual pipeline count and setup-time delta from internal dashboards.
- **Evidence:** Numbers sourced from the internal migration retro
- **Depends on:** —
- **Completed:** —

**Earns**

- `R2` · *Experience — Northwind Logistics* — Led the migration of 40+ batch training and ETL pipelines to Kubernetes, cutting job setup from days to hours.

## M3 — Profile NCCL collectives on the harness

- [ ] done
- **Start:** 2026-10-16
- **Due:** 2026-11-06
- **Where:** Own time
- **Deliverable:** Profiling write-up: where the all-reduce time actually goes at 4 and 8 GPUs.
- **Evidence:** `github.com/amoreau/fsdp-harness/docs/profiling.md`
- **Depends on:** M1
- **Learning:** NCCL docs · Nsight Systems
- **Completed:** —

**Earns**

- `P3` · *Skills* — NCCL profiling, Nsight Systems

## M4 — First upstream contribution to a training library

- [ ] done
- **Start:** 2026-10-20
- **Due:** 2026-12-12
- **Where:** Own time
- **Deliverable:** Gradient-checkpointing fix, from issue triage to merged PR.
- **Evidence:** Merged pull request in the upstream repository
- **Depends on:** M1
- **Completed:** —

**Earns**

- `P4` · *Projects* — Contributed gradient-checkpointing fixes to an open-source training library, merged upstream.

## M5 — Publish the distributed-training failure-modes teardown

- [ ] done
- **Start:** 2026-12-01
- **Due:** 2027-02-14
- **Where:** Own time
- **Deliverable:** Long-form post drawn from M1 and M3.
- **Evidence:** Published post with a public URL
- **Depends on:** M3
- **Completed:** —

**Earns**

- `P5` · *Projects* — Published a written teardown of distributed-training failure modes.

## M6 — Run an internal reading group on scaling laws

- [ ] done
- **Start:** 2026-09-15
- **Due:** 2026-11-30
- **Where:** At work
- **Deliverable:** Six sessions, notes published to the internal wiki.
- **Evidence:** Internal wiki page with session notes and attendance
- **Depends on:** —
- **Learning:** Chinchilla · scaling-laws papers
- **Completed:** —

**Earns**

- `P6` · *Experience — Northwind Logistics* — Founded and ran a scaling-laws reading group for 12 engineers across two teams.

## M7 — Take the inference path of one production model

- [ ] done
- **Start:** 2026-11-01
- **Due:** 2027-01-20
- **Where:** At work
- **Deliverable:** Own serving latency for the routing model end to end.
- **Evidence:** Service ownership recorded in the team's on-call rota
- **Depends on:** —
- **Completed:** —

**Earns**

- `P7` · *Experience — Northwind Logistics* — Owned the inference path for a production ranking model serving 8M requests a day.

## M8 — Rebuild the billing pipeline bullet around throughput

- [ ] done
- **Start:** 2026-09-05
- **Due:** 2026-09-19
- **Where:** At work
- **Deliverable:** Recover the throughput and cost numbers from the 2021 rollout.
- **Evidence:** Figures confirmed against the archived rollout report
- **Depends on:** —
- **Completed:** —

**Earns**

- `R3` · *Experience — Kestrel Systems* — Built the billing reconciliation pipeline processing 3.2M transactions nightly in Python and Postgres.

## M9 — Reproduce a paper end to end

- [ ] done
- **Start:** 2026-11-10
- **Due:** 2027-01-09
- **Where:** Own time
- **Deliverable:** Reproduction repo with results table against the published numbers.
- **Evidence:** `github.com/amoreau/repro-<paper>` with results table
- **Depends on:** M1
- **Completed:** —

**Earns**

- `P8` · *Projects* — Reproduced a published training-efficiency result end to end, matching reported numbers within 3%.

## M10 — Give the teardown as a meetup talk

- [ ] done
- **Start:** 2027-01-05
- **Due:** 2027-02-20
- **Where:** Own time
- **Deliverable:** 25-minute talk at a local ML meetup, slides published.
- **Evidence:** Meetup event listing plus published slides
- **Depends on:** M5
- **Completed:** —

**Earns**

- `P9` · *Projects* — Spoke on distributed-training failure modes at a Berlin ML meetup.

## M11 — Second and third upstream contributions

- [ ] done
- **Start:** 2026-12-15
- **Due:** 2027-02-20
- **Where:** Own time
- **Deliverable:** Two further merged PRs, at least one non-trivial.
- **Evidence:** Two merged pull requests
- **Depends on:** M4
- **Completed:** —

**Earns**

- `P10` · *Projects* — Sustained contributor to an open-source training library — three merged pull requests.

## M12 — Rewrite the headline for the target

- [ ] done
- **Start:** 2027-02-15
- **Due:** 2027-02-26
- **Where:** Own time
- **Deliverable:** Final pass over the projection once the evidence exists.
- **Evidence:** The finished projection PDF
- **Depends on:** M1,M4,M5
- **Completed:** —

**Earns**

- `R1` · *Header* — Machine Learning Engineer — Distributed Training
