# Timeline Builder — Acceptance Test Plan

**Version:** 1.0  
**Status:** Ready for pilot  
**Audience:** Operators, project leads, QA reviewers  
**Prerequisite:** Production export from Smartsheet (CSV or XLSX)

---

## Purpose

Validate that Timeline Builder solves the real workflow problem:

> Turn a Smartsheet schedule export into a presentation-quality executive roadmap without manual Excel formatting.

This plan is used during **pilot acceptance** with actual production exports—not synthetic test data.

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| Real Smartsheet exports | Feature development |
| Excel output quality | Architecture changes |
| Validation report accuracy | AI integrations |
| Optional Google Sheets publish | Redesign of workbook layout |
| Operator workflow timing | |

---

## Acceptance Testing Checklist

Complete one row per pilot run. Use **at least three** distinct production exports before sign-off.

### A. Input & Environment

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| A1 | Export uses required columns: Project, Task Name, Start Date, Finish Date, Critical Date | ☐ | ☐ | |
| A2 | Export opens without corruption in Excel/Numbers | ☐ | ☐ | |
| A3 | Python environment runs `python timeline_builder.py --help` | ☐ | ☐ | |
| A4 | `pytest tests/ -q` passes on operator machine (optional sanity check) | ☐ | ☐ | |

### B. Generation (Excel-first)

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| B1 | `Timeline.xlsx` generated without manual intervention | ☐ | ☐ | |
| B2 | `ValidationReport.json` generated alongside output | ☐ | ☐ | |
| B3 | Operator summary printed with row counts | ☐ | ☐ | |
| B4 | Project sections match Smartsheet row order (contiguous blocks) | ☐ | ☐ | |
| B5 | Non-contiguous duplicate project names appear as separate sections | ☐ | ☐ | |
| B6 | Weekly columns span earliest start through latest finish | ☐ | ☐ | |
| B7 | Critical dates extend timeline span when outside task duration | ☐ | ☐ | |
| B8 | Month headers merged correctly across week columns | ☐ | ☐ | |
| B9 | Task names appear only in first active week of each bar | ☐ | ☐ | |
| B10 | Phase colors match expected categories (sample 5+ tasks) | ☐ | ☐ | |
| B11 | Critical date weeks render red | ☐ | ☐ | |
| B12 | Columns A–E frozen; timeline scrolls horizontally | ☐ | ☐ | |
| B13 | Project rows collapse/expand in Excel | ☐ | ☐ | |
| B14 | Output acceptable for executive review without manual edits | ☐ | ☐ | |

### C. Validation & Trust

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| C1 | Every skipped row documented in `ValidationReport.json` | ☐ | ☐ | |
| C2 | Skipped rows include row number, reason, source values | ☐ | ☐ | |
| C3 | Operator can explain why a missing task was excluded | ☐ | ☐ | |
| C4 | `--strict` blocks output when validation errors exist | ☐ | ☐ | |
| C5 | Non-strict run produces timeline when some rows are invalid | ☐ | ☐ | |
| C6 | No `"nan"` project names in output | ☐ | ☐ | |

### D. Google Sheets (if pilot includes publish)

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| D1 | `--publish-google` completes after Excel generation | ☐ | ☐ | |
| D2 | Google publish failure still leaves `Timeline.xlsx` intact | ☐ | ☐ | |
| D3 | Timeline tab replaced/created in target sheet | ☐ | ☐ | |
| D4 | Colors, merges, freeze panes recognizable in browser | ☐ | ☐ | |
| D5 | Row groups functional in Google Sheets | ☐ | ☐ | |
| D6 | Sheet URL returned in operator summary | ☐ | ☐ | |

### E. Workflow Problem (overall)

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| E1 | Faster than previous manual timeline process | ☐ | ☐ | See timing report |
| E2 | Eliminates repetitive formatting work | ☐ | ☐ | |
| E3 | Stakeholders accept output without rework | ☐ | ☐ | |
| E4 | Operator trusts validation report over guesswork | ☐ | ☐ | |
| E5 | Process repeatable weekly without code changes | ☐ | ☐ | |

### Sign-off

| Role | Name | Date | Accept / Reject |
|------|------|------|-----------------|
| Operator | | | |
| Project lead | | | |
| Executive reviewer (optional) | | | |

**Minimum for acceptance:** All B1–B14 and C1–C6 pass on ≥3 production exports. D-section required only if Google publish is in scope.

---

## Workflow Timing Report Template

Record **before** (manual process) and **after** (Timeline Builder) for each pilot cycle.

### Run metadata

| Field | Value |
|-------|-------|
| Pilot run ID | |
| Date | |
| Operator | |
| Export file name | |
| Project count | |
| Task count (source) | |
| Valid tasks (report) | |
| Skipped rows (report) | |
| Timeline weeks | |
| Google publish? | Yes / No |

### Time study (minutes)

| Step | Before (manual) | After (Timeline Builder) |
|------|-----------------|--------------------------|
| Export from Smartsheet | | |
| Clean / fix data | | |
| Build timeline layout | | |
| Apply colors & formatting | | |
| Review & fix errors | | |
| Publish / distribute | | |
| **Total** | | |

### Command used

```bash
# Record exact command
python timeline_builder.py ___________________________
```

### Runtime metrics (from operator summary / stopwatch)

| Metric | Value |
|--------|-------|
| CLI runtime (seconds) | |
| Google publish runtime (seconds, if applicable) | |
| Manual review time (minutes) | |
| Manual edits required? | Yes / No — describe |

### Qualitative assessment

**What improved:**

**What still required manual work:**

**Blockers for weekly use:**

---

## Production Rollout Plan

### Phase 0 — Pre-rollout (Week 0)

| Task | Owner | Done |
|------|-------|------|
| Complete environment setup per `OPERATIONAL_RUNBOOK.md` | Operator | ☐ |
| Run sample dataset end-to-end | Operator | ☐ |
| Configure `colors.yaml` for org task naming | Admin | ☐ |
| Configure Google credentials (if using publish) | Admin | ☐ |
| Share standing Google Sheet with service account | Admin | ☐ |
| Complete `RELEASE_CHECKLIST.md` | Admin | ☐ |

### Phase 1 — Pilot (Weeks 1–2)

| Task | Owner | Done |
|------|-------|------|
| Select 2–3 active production schedules | Project lead | ☐ |
| Run acceptance checklist for each export | Operator | ☐ |
| Collect pilot feedback (`PILOT_FEEDBACK_FORM.md`) | Project lead | ☐ |
| Record workflow timing reports | Operator | ☐ |
| Review all `ValidationReport.json` files | Operator | ☐ |
| Executive review of output quality | Stakeholder | ☐ |
| Go / no-go decision | Project lead | ☐ |

### Phase 2 — Limited production (Weeks 3–4)

| Task | Owner | Done |
|------|-------|------|
| Roll out to primary operator(s) only | Admin | ☐ |
| Establish weekly run cadence (see runbook) | Operator | ☐ |
| Use `--strict` in any automated jobs | Admin | ☐ |
| Document org-specific quirks in runbook appendix | Operator | ☐ |
| Monitor skipped-row rates | Project lead | ☐ |

### Phase 3 — General availability (Week 5+)

| Task | Owner | Done |
|------|-------|------|
| Train backup operator | Admin | ☐ |
| Add Timeline Builder to team onboarding docs | Admin | ☐ |
| Declare v1 successful (see criteria below) | Project lead | ☐ |
| Prioritize Phase A items from `PRODUCT_ROADMAP.md` | Project lead | ☐ |

### Rollback trigger

Roll back to manual process if **any** of the following occur in pilot:

- Executive rejects output quality on ≥2 of 3 pilot runs
- Validation report cannot explain >10% row loss
- Critical milestones missing from roadmap
- Google publish failure blocks operators from delivering Excel on time

Rollback does **not** require code changes—revert to prior manual workflow until issues are documented and addressed via roadmap.

---

## Acceptance Test Scenarios (reference)

Run these with real exports when available:

| Scenario | Input condition | Expected outcome |
|----------|-----------------|------------------|
| Clean export | All rows valid | 0 errors; full timeline |
| Messy export | Missing dates on some rows | Skipped rows in report; partial timeline |
| Strict CI | Invalid rows present | Exit 3; no timeline |
| Cross-year portfolio | Tasks span Dec–Jan | Month headers include both years |
| Critical milestone | Critical outside task dates | Red bar visible on critical week |
| Duplicate project blocks | Same name in non-contiguous rows | Separate project sections |
| Large portfolio | 100+ tasks | Completes in <30 s; usable in Excel |
| Publish workflow | `--publish-google --sheet-id` | Excel + Sheet updated; URL in summary |

---

## Related documents

- `PILOT_FEEDBACK_FORM.md` — stakeholder feedback collection
- `OPERATIONAL_RUNBOOK.md` — day-to-day procedures
- `RELEASE_CHECKLIST.md` — release gate
- `PRODUCT_ROADMAP.md` — post-v1 priorities
