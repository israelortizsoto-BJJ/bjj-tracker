# Timeline Builder v1 — Release Checklist

**Release version:** 1.0  
**Release owner:** _______________  
**Target date:** _______________

Use this checklist before declaring Timeline Builder v1 generally available to the team.

---

## 1. Code & quality gate

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 1.1 | All automated tests pass (`pytest tests/ -q`) | ☐ | | 52 tests expected |
| 1.2 | Sample dataset generates valid output | ☐ | | `sample_schedule.csv` |
| 1.3 | Medium dataset completes (<30 s) | ☐ | | `TEST_DATASETS/B_medium_*` |
| 1.4 | No uncommitted local patches on release tag | ☐ | | |
| 1.5 | `requirements.txt` matches tested environment | ☐ | | |
| 1.6 | `README.md` reflects current CLI flags | ☐ | | |
| 1.7 | `PRODUCTION_READINESS.md` reviewed | ☐ | | Score ≥ 8/10 |

---

## 2. Configuration & secrets

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 2.1 | `colors.yaml` reviewed for org task names | ☐ | | |
| 2.2 | `google_config.yaml` paths correct for prod | ☐ | | |
| 2.3 | Service account JSON installed (not in git) | ☐ | | |
| 2.4 | Google Sheets API enabled in GCP project | ☐ | | |
| 2.5 | Standing sheet shared with service account | ☐ | | Editor access |
| 2.6 | Credential rotation procedure documented | ☐ | | See runbook R5 |

---

## 3. Acceptance & pilot

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 3.1 | ≥3 production exports tested | ☐ | | |
| 3.2 | `ACCEPTANCE_TEST_PLAN.md` checklist completed | ☐ | | |
| 3.3 | Workflow timing reports recorded | ☐ | | |
| 3.4 | `PILOT_FEEDBACK_FORM.md` collected (≥2 respondents) | ☐ | | |
| 3.5 | Executive reviewer sign-off on output quality | ☐ | | |
| 3.6 | Known limitations communicated to stakeholders | ☐ | | Excel-first; Sheets limitations |
| 3.7 | Go / no-go decision documented | ☐ | | |

---

## 4. Operations readiness

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 4.1 | `OPERATIONAL_RUNBOOK.md` distributed to operators | ☐ | | |
| 4.2 | Primary operator trained | ☐ | | |
| 4.3 | Backup operator identified | ☐ | | |
| 4.4 | Weekly run schedule defined | ☐ | | |
| 4.5 | Output naming convention agreed | ☐ | | e.g. dated filenames |
| 4.6 | Validation review procedure understood | ☐ | | |
| 4.7 | Recovery procedures (R1–R6) reviewed | ☐ | | |
| 4.8 | Escalation path defined | ☐ | | |

---

## 5. Google publish (if in scope)

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 5.1 | Live publish test completed once | ☐ | | Not mocked |
| 5.2 | Standing `--sheet-id` workflow verified | ☐ | | |
| 5.3 | Publish failure fallback tested | ☐ | | Excel still delivered |
| 5.4 | Stakeholders informed Sheets ≠ Excel parity | ☐ | | |

---

## 6. Release day

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 6.1 | Tag or label release version | ☐ | | e.g. `timeline-builder-v1.0` |
| 6.2 | Announce availability to team | ☐ | | |
| 6.3 | Link runbook in team wiki / shared drive | ☐ | | |
| 6.4 | First production run supervised | ☐ | | |
| 6.5 | First week outputs archived for reference | ☐ | | |

---

## 7. Post-release (first 30 days)

| # | Item | Done | Owner | Notes |
|---|------|------|-------|-------|
| 7.1 | Weekly skipped-row rate tracked | ☐ | | Target: <5% |
| 7.2 | No critical milestone misses reported | ☐ | | |
| 7.3 | Operator time savings documented | ☐ | | vs baseline |
| 7.4 | Incidents logged and triaged | ☐ | | |
| 7.5 | v1 success criteria evaluated | ☐ | | See below |
| 7.6 | Phase A roadmap items prioritized | ☐ | | `PRODUCT_ROADMAP.md` |

---

## Release sign-off

| Role | Name | Signature / date | Approved |
|------|------|------------------|----------|
| Release owner | | | ☐ |
| Primary operator | | | ☐ |
| Project lead | | | ☐ |

**Release decision:** ☐ Ship v1  ☐ Delay  ☐ Rollback to manual

**Conditions / follow-up:**

---

## v1 success criteria (evaluate at day 30)

Declare v1 successful when **all** are true:

1. **Adoption** — Primary operator uses tool for ≥4 consecutive weekly cycles without reverting to manual formatting  
2. **Quality** — ≥90% of pilot/early reviewers rate output ≥4/5 for executive readiness  
3. **Trust** — 100% of skipped rows explainable via `ValidationReport.json`; zero unexplained missing tasks  
4. **Efficiency** — Median time-to-deliver reduced ≥50% vs manual baseline (timing reports)  
5. **Reliability** — Zero critical incidents (wrong milestones, silent data loss) in 30-day window  
6. **Recovery** — All incidents resolved using runbook procedures without code hotfixes

If criteria not met, extend pilot or prioritize Phase A roadmap items before declaring GA.

---

## Related documents

- `ACCEPTANCE_TEST_PLAN.md`
- `OPERATIONAL_RUNBOOK.md`
- `PILOT_FEEDBACK_FORM.md`
- `PRODUCT_ROADMAP.md`
