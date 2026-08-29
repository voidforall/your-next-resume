---
target: Machine Learning Engineer — applied, mid-level
ultimate_target: Staff Machine Learning Engineer — Training Infrastructure
next_hop_horizon: roughly two to three years beyond this window
target_source: a Staff ML Engineer posting at a frontier lab
window_start: 2026-09-01
window_end: 2027-02-28
generated: 2026-08-29
own_time_capacity: an hour or two a week
---

# Roadmap — Machine Learning Engineer (first hop)

## Reachability

### Closeable in this window
- Fluency with a modern ML framework and the training loop
- Evidence of shipping something others use
- Reading and reproducing published work

### Needs longer
- Depth in distributed training and its failure modes
- A track record of infrastructure other engineers depend on

### Needs a different job first
- Owning multi-node training infrastructure in production
- Setting technical direction for a team of researchers

## M1 — Ship a model into the reporting tools you already own

- [ ] done
- **Start:** 2026-09-01
- **Due:** 2026-11-14
- **Where:** At work
- **Deliverable:** A demand-forecasting model behind an endpoint the reporting tools call.
- **Evidence:** The service in the internal repo, with its evaluation notebook
- **Depends on:** —
- **Learning:** scikit-learn docs · your team's deployment runbook
- **Completed:** —

**Earns**

- `P1` · *Experience — Brightpath Retail* — Shipped a demand-forecasting model behind an internal service used by the reporting suite.
- `P2` · *Skills* — scikit-learn, model evaluation

## M2 — Reproduce a published result end to end

- [ ] done
- **Start:** 2026-11-15
- **Due:** 2027-01-16
- **Where:** Own time
- **Deliverable:** A public repo reproducing a small published training result.
- **Evidence:** `github.com/sortiz/repro-<paper>` with a results table
- **Depends on:** M1
- **Learning:** the paper and its reference implementation
- **Completed:** —

**Earns**

- `P3` · *Projects* — Reproduced a published training result end to end, matching the reported numbers within 5%.

## M3 — Own the training pipeline for that model

- [ ] done
- **Start:** 2027-01-05
- **Due:** 2027-02-20
- **Where:** At work
- **Deliverable:** Scheduled retraining, monitoring and rollback for the M1 model.
- **Evidence:** The pipeline in the internal repo and its on-call runbook
- **Depends on:** M1
- **Completed:** —

**Earns**

- `P4` · *Experience — Brightpath Retail* — Owned the retraining and monitoring pipeline for a production forecasting model.

## M4 — Rewrite the headline for the first hop

- [ ] done
- **Start:** 2027-02-15
- **Due:** 2027-02-26
- **Where:** Own time
- **Deliverable:** Final pass over the projection once the evidence exists.
- **Evidence:** The finished projection PDF
- **Depends on:** M1,M2,M3
- **Completed:** —

**Earns**

- `R1` · *Header* — Machine Learning Engineer — applied
