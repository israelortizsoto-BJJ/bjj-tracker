# Timeline Builder — Product Roadmap

**Document type:** Future planning (no implementation committed)  
**Current version:** 1.0 (production-ready)  
**Last updated:** 2026-06-23  
**Owner:** Project lead

This roadmap captures prioritized future work **after v1 general availability**. Items are documented for planning only—none are in scope unless explicitly scheduled.

---

## Guiding principles

1. **Excel-first** — Timeline.xlsx remains the canonical deliverable  
2. **Operator trust** — Validation transparency over silent automation  
3. **No AI in core path** — AI enhancements are Phase D and optional only  
4. **Incremental value** — Operational reliability before feature expansion

---

## Priority overview

| Phase | Theme | Priority | Target window |
|-------|-------|----------|---------------|
| **A** | Operational improvements | **P0 — post-v1 immediate** | Weeks 1–8 after GA |
| **B** | Usability improvements | **P1 — near term** | Months 2–4 |
| **C** | Advanced automation | **P2 — medium term** | Months 4–8 |
| **D** | AI-assisted enhancements | **P3 — exploratory** | 6+ months; gated |

---

## Phase A — Operational improvements

*Reduce friction, close production gaps, increase operator confidence.*

| ID | Item | Problem solved | Priority | Effort | Dependencies |
|----|------|----------------|----------|--------|--------------|
| A1 | Column name alias map | Smartsheet exports with variant headers fail | High | S | None |
| A2 | Config schema validation (`colors.yaml`, `google_config.yaml`) | Runtime crashes on typos | High | S | None |
| A3 | Structured exit codes + `--dry-run` | CI cannot validate without generating | High | M | None |
| A4 | Skip-rate threshold warning | Operator misses high row-loss runs | High | S | None |
| A5 | Output metadata sheet/footer | Audit trail (source file, timestamp, version) | Medium | S | None |
| A6 | Dependency lockfile | Reproducible installs across machines | Medium | S | None |
| A7 | Live Google publish smoke test in CI (sandbox) | Phase 4 tested with mocks only | Medium | M | GCP sandbox |
| A8 | Large timeline publish profiling | Slow Google publish on 500+ tasks | Medium | M | A7 |
| A9 | Credential rotation runbook automation | Manual key rotation error-prone | Low | S | None |
| A10 | `--report-format csv` for validation | Non-technical reviewers prefer spreadsheet | Low | S | None |

**Phase A success metric:** Skipped-row surprises drop to near zero; setup time for new operator <30 minutes.

---

## Phase B — Usability improvements

*Improve executive presentation and operator experience without changing core generation logic.*

| ID | Item | Problem solved | Priority | Effort | Dependencies |
|----|------|----------------|----------|--------|--------------|
| B1 | Color legend sheet/tab | Stakeholders don't know phase colors | High | S | None |
| B2 | Print layout profiles | Wide timelines unreadable when printed | High | M | None |
| B3 | Dynamic label column width | Long task names truncate in week cells | Medium | S | None |
| B4 | Month header by calendar month | Week-start labeling confuses boundary weeks | Medium | M | Design review |
| B5 | Compact view mode (hide C–E) | Screen clutter on wide portfolios | Medium | M | None |
| B6 | Summary dashboard sheet | Exec wants counts without scrolling timeline | Medium | M | None |
| B7 | Improved Google Sheets border transfer | Sheets version looks flat vs Excel | Low | L | A8 |
| B8 | Locale-aware date parsing option | Ambiguous US/EU date strings | Medium | M | A1 |
| B9 | Org-specific color themes (presets) | Re-configuring YAML per team is tedious | Low | S | A2 |
| B10 | HTML preview export | Quick share without Excel license | Low | M | None |

**Phase B success metric:** Executive readiness rating ≥4.5/5 without manual post-processing.

---

## Phase C — Advanced automation

*Reduce operator steps; integrate into existing toolchain.*

| ID | Item | Problem solved | Priority | Effort | Dependencies |
|----|------|----------------|----------|--------|--------------|
| C1 | Scheduled weekly run (cron / GitHub Action) | Manual invocation forgotten | High | M | A3, secrets mgmt |
| C2 | Smartsheet API direct pull | Manual export step eliminated | High | L | Smartsheet API access |
| C3 | Watch folder / file drop trigger | Operator must remember command | Medium | M | C1 |
| C4 | Slack / email notification on completion | Stakeholders wait for operator ping | Medium | M | C1 |
| C5 | Notification on validation failures | Skipped rows discovered late | Medium | S | A4 |
| C6 | Versioned output archive | Hard to compare week-over-week | Medium | M | A5 |
| C7 | Diff report (week-over-week changes) | Exec asks "what moved?" | Medium | L | C6 |
| C8 | Multi-portfolio batch mode | Multiple exports processed manually | Low | L | A3 |
| C9 | SharePoint / Drive upload hook | Second manual upload step | Low | M | Org IT |
| C10 | Standing Google Sheet auto-share list | Manual sharing after new sheet create | Low | S | Phase 4 publish |

**Phase C success metric:** Weekly roadmap delivered with zero manual CLI invocation for standard portfolios.

---

## Phase D — AI-assisted enhancements

*Optional intelligence layer. Not required for core workflow. Gated behind explicit opt-in.*

> **Policy:** No AI in validation, grouping, or date logic without human-review gate. AI suggests; operator approves.

| ID | Item | Problem solved | Priority | Effort | Dependencies |
|----|------|----------------|----------|--------|--------------|
| D1 | Task name → phase suggestion (review queue) | Miscategorized colors on novel task names | Low | M | B1, policy |
| D2 | Natural language validation summary | JSON report hard for non-technical users | Low | S | A10 |
| D3 | Anomaly detection on skipped rows | Unusual skip patterns missed | Low | M | A4, history |
| D4 | Executive narrative summary (optional tab) | PM writes same intro email weekly | Low | L | C6, policy |
| D5 | Smartsheet column mapping assistant | Export columns vary by sheet template | Low | M | A1, D1 |
| D6 | Chat-based operator help (docs only) | Runbook lookup friction | Low | M | Runbook corpus |

**Phase D entry criteria:**

- v1 successful for ≥90 days  
- Phase A complete  
- Data governance review approved  
- No AI processing of data without documented retention policy

**Phase D success metric:** Measurable reduction in color misclassification rework; zero unreviewed AI changes applied to production output.

---

## Explicitly out of scope (v1.x planning)

| Item | Rationale |
|------|-----------|
| Replace Excel with Google Sheets as primary | Excel-first architecture |
| Real-time Smartsheet sync | Complexity; Phase C2 is batch pull only |
| Gantt / dependency visualization | Different product surface |
| Resource loading / FTE views | Beyond roadmap scope |
| AI auto-fix of source data | Violates operator trust model |
| Gemini / generic LLM integration | Not requested for v1.x |

---

## Recommended sequencing

```
v1 GA ──► Phase A (weeks 1–8) ──► Phase B (months 2–4)
                                      │
                                      ▼
                               Phase C (months 4–8)
                                      │
                                      ▼
                               Phase D (gated, 6+ mo)
```

**Do not start Phase D until Phase A is substantially complete.**

---

## How items get prioritized

Score each candidate 1–5 on:

| Factor | Weight |
|--------|--------|
| Reduces operator time | 30% |
| Increases output trust | 25% |
| Reduces executive rework | 20% |
| Implementation effort (inverse) | 15% |
| Aligns with Excel-first | 10% |

Review quarterly or after any production incident.

---

## Feedback intake

| Source | Feeds roadmap |
|--------|---------------|
| `PILOT_FEEDBACK_FORM.md` | B, C |
| Skipped-row incident logs | A |
| Workflow timing reports | A, C |
| Executive review sessions | B |
| Google publish issues | A, B |

---

## Related documents

- `ACCEPTANCE_TEST_PLAN.md` — validates v1 against real exports  
- `RELEASE_CHECKLIST.md` — v1 ship gate  
- `OPERATIONAL_RUNBOOK.md` — current procedures  
- `PRODUCTION_READINESS.md` — technical readiness score
