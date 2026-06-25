# Migration Plan — Python Timeline Builder → Live Sheets Planner

## Strategy

**Do not replace Python overnight.** Run a phased migration:

| Phase | Python batch tool | Live Sheets planner |
|-------|-------------------|---------------------|
| Now (MVP) | Visual spec + optional weekly snapshot | Primary PM planning surface |
| Pilot | Smartsheet → Data tab import (manual paste) | Daily editing |
| Steady state | Scheduled snapshot / archive | Live source of truth |
| Future | Import-only or retired | Full parity + automation |

---

## What maps directly

| Python component | Sheets MVP equivalent | Status |
|------------------|----------------------|--------|
| `read_schedule()` / Data columns | Data tab | Manual entry / paste |
| `validate_and_normalize()` | `Validation.gs` | Ported (MVP) |
| `ValidationReport.json` | Validation tab | Ported (sheet format) |
| `color_matcher.py` | `ColorMatcher.gs` | Ported |
| `colors.yaml` | Config tab | Ported (sheet format) |
| `group_tasks_by_project()` contiguous | `TimelineEngine.gs` | Ported |
| `build_week_columns()` + critical span | `TimelineEngine.gs` | Ported |
| `build_workbook()` layout | `buildTimelineSheet()` | Ported (MVP) |
| `--strict` / CLI exit codes | — | Not in MVP |
| `google_sheets_publisher.py` | Native Timeline tab | Replaced by live sheet |
| Smartsheet file import | — | Manual (MVP) |

---

## Migration steps

### Step 1 — Parallel run (Week 1–2)

**Goal:** Prove Sheets MVP matches Python output quality on same data.

1. Export Smartsheet → CSV  
2. Run Python: `python timeline_builder.py export.csv -o python_timeline.xlsx`  
3. Paste same rows into Sheets **Data** tab  
4. Run **Refresh Timeline**  
5. Compare side-by-side:
   - Week span  
   - Project sections  
   - Phase colors (sample 10 tasks)  
   - Critical red weeks  
   - Skipped rows vs Validation tab  

**Acceptance:** PM confirms Sheets timeline is acceptable for exec review.

### Step 2 — Switch PM workflow (Week 3)

**Goal:** PMs edit only in Sheets.

1. Distribute Live Planner spreadsheet link  
2. Stop manual Excel formatting  
3. Python runs only for weekly **archive snapshot** (optional):

   ```bash
   python timeline_builder.py export.csv -o archive/2026-06-23_Timeline.xlsx
   ```

4. Document in team wiki: **Sheets = live; XLSX = snapshot**

### Step 3 — Data import automation (Week 4+)

**Goal:** Reduce paste step from Smartsheet.

Options (pick one later — not MVP):

| Option | Effort | Description |
|--------|--------|-------------|
| Manual paste | Done | Copy export into Data |
| Python import script | Low | Script writes to Sheet via API |
| Smartsheet → CSV drop | Low | Watch folder + import tab |
| Smartsheet API | Medium | Scheduled pull into Data tab |

### Step 4 — Decommission Python render path (optional)

Only when:

- Sheets MVP stable ≥30 days  
- No exec requirement for offline XLSX  
- Snapshot need met by **File → Download → Microsoft Excel** from Sheets  

Keep Python if:

- CI validation gates on Smartsheet exports  
- Legal/compliance requires JSON validation artifact  

---

## Data migration procedure

### Smartsheet export → Data tab

1. Export with columns: Project, Task Name, Start Date, Finish Date, Critical Date  
2. Open Data tab  
3. Paste values starting at **A2** (preserve header row)  
4. Format columns C–E as dates if needed  
5. **Refresh Timeline**  
6. Review Validation tab for skipped rows  

### Config migration from `colors.yaml`

1. Open Config tab (created by setup)  
2. Compare categories to `../colors.yaml`  
3. Adjust patterns/fills if org-specific names differ  
4. Refresh Timeline to apply  

---

## Role changes

| Role | Before (Python) | After (Sheets MVP) |
|------|-----------------|---------------------|
| PM | Export + request timeline / wait | Edit Data tab directly |
| Operator | Run CLI, share XLSX | Run setup once; Refresh if needed |
| Exec | Review Timeline.xlsx | Review Timeline tab (or PDF export) |
| Admin | Maintain Python env | Maintain Apps Script + Config tab |

---

## Rollback plan

If Sheets MVP fails pilot:

1. Revert PM workflow to Smartsheet → Python → Timeline.xlsx (documented in `../OPERATIONAL_RUNBOOK.md`)  
2. Keep Live Planner spreadsheet for experimentation  
3. Log gaps in `../PRODUCT_ROADMAP.md` Phase A/B  

No data loss — Smartsheet remains upstream if maintained.

---

## Known MVP gaps vs Python

| Gap | Workaround | Roadmap |
|-----|------------|---------|
| No Smartsheet auto-import | Manual paste | Phase C |
| No strict CI mode | Manual validation review | Phase A |
| No JSON validation export | Validation tab | Phase A |
| Trigger delay ~2s | Accept or manual Refresh | — |
| Scale >200 tasks | Split portfolios | Phase A |
| Print layout | Download / PDF from Sheets | Phase B |

---

## Success criteria for migration complete

Migration is **complete** when:

1. PMs use Sheets Data tab as sole schedule edit surface for ≥4 weeks  
2. Python CLI not required for day-to-day planning  
3. Validation tab replaces ad-hoc "missing task" questions  
4. Executive reviews Timeline tab (or exported PDF) without manual reformatting  
5. Optional Python snapshot runs ≤1×/week for archive only  

---

## File reference

| Python (reference) | Sheets MVP |
|--------------------|------------|
| `timeline_builder.py` | `TimelineEngine.gs` + `Main.gs` |
| `validation.py` | `Validation.gs` |
| `color_matcher.py` | `ColorMatcher.gs` |
| `colors.yaml` | Config tab |
| `sample_schedule.csv` | `setupLivePlanner()` sample rows |
