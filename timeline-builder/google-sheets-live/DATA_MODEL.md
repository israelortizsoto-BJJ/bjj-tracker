# Data Model — Live Timeline Planner

## Sheet: Data

**Purpose:** Editable schedule input. One row per task.

| Column | Letter | Type | Required | Notes |
|--------|--------|------|----------|-------|
| Project | A | text | Yes | Section header source |
| Task Name | B | text | Yes | Drives color matching |
| Start Date | C | date | Yes | Task bar start |
| Finish Date | D | date | Yes | Task bar end |
| Critical Date | E | date | No | Red week override |

**Row 1:** Headers (frozen)  
**Row 2+:** Task data  

**Ordering:** Rows are processed top-to-bottom. Contiguous rows with the same Project form one collapsible section. Non-contiguous duplicate project names produce separate sections (matches Python behavior).

**Date cells:** Use Sheets date format. Script accepts Date objects and ISO strings.

---

## Sheet: Config

**Purpose:** Color rules and presentation theme. Edit rarely.

### Category rules (rows 2+ until blank)

| Column | Field | Example |
|--------|-------|---------|
| A | Category name | `Shoot` |
| B | Patterns (pipe-separated) | `shoot\|filming\|on set` |
| C | Fill hex | `#9DC3E6` |
| D | Font hex | `#1F3864` |

Category names must match precedence keys in `Constants.gs` (or defaults in `Config.gs`).

### Theme section (after blank row)

| Key | Default | Purpose |
|-----|---------|---------|
| criticalFill | #C00000 | Critical week bar |
| criticalFont | #FFFFFF | Critical week text |
| defaultFill | #D9D9D9 | Unmatched task names |
| defaultFont | #404040 | Default text |
| headerFill / headerFont | #203864 / #FFFFFF | Row 3 headers |
| projectHeaderFill / projectHeaderFont | #E7E6E6 / #203864 | Project rows |
| monthHeaderFill / monthHeaderFont | #F2F2F2 / #404040 | Row 1 |
| weekHeaderFill / weekHeaderFont | #FAFAFA / #595959 | Row 2 |
| altRowFill | #F9F9F9 | Alternating task rows |

---

## Sheet: Timeline

**Purpose:** Generated executive roadmap. **Do not edit for schedule changes.**

| Rows | Content |
|------|---------|
| 1 | Month labels (merged across weeks) |
| 2 | Week start / end dates |
| 3 | Column headers (Project…Critical, W1…Wn) |
| 4+ | Project header rows + task rows |

| Columns | Content |
|---------|---------|
| A | Project (empty on task rows; name on header rows) |
| B | Task name |
| C | Start date |
| D | Finish date |
| E | Critical date |
| F+ | Weekly bars (value + background color) |

**Frozen:** Row 3, column E  
**Row groups:** Task rows under each project header  

---

## Sheet: Validation

**Purpose:** Human-readable validation report (replaces `ValidationReport.json` in MVP).

### Summary (rows 1–9)

| Field | Description |
|-------|-------------|
| Updated At | Last refresh timestamp |
| Total Rows | Data rows scanned |
| Valid Rows | Included in timeline |
| Skipped Rows | Error count |
| Warnings | Warning count |
| Errors | Error count |
| Timeline Generated | Yes/No |

### Issues table (row 11+)

| Column | Description |
|--------|-------------|
| Row Number | Data sheet row (1-based, row 1 = header) |
| Kind | `error` or `warning` |
| Reason | Machine reason code |
| Project … Critical Date | Source values |

### Reason codes

| Reason | Kind | Effect |
|--------|------|--------|
| missing_project | error | Row skipped |
| missing_task_name | error | Row skipped |
| missing_start_date | error | Row skipped |
| missing_finish_date | error | Row skipped |
| invalid_start_date | error | Row skipped |
| invalid_finish_date | error | Row skipped |
| finish_before_start | warning | Dates swapped; row kept |
| invalid_critical_date | warning | Critical ignored; row kept |

---

## Internal task object (script memory)

```javascript
{
  project: string,
  taskName: string,
  startDate: Date,
  finishDate: Date,
  criticalDate: Date | null,
  sourceRow: number
}
```

Not persisted — rebuilt on each `refreshTimeline()`.

---

## Color precedence (fixed in code)

1. Delivery / Air / Live  
2. Review / Approval  
3. Edit / Post / VFX / Color  
4. Shoot  
5. Pre Pro / Prep  
6. Concepting  

Word-boundary pattern match on **Task Name** (same algorithm as Python `color_matcher.py`).

---

## Week grid calculation

```
earliest = min(all start dates, all critical dates)
latest   = max(all finish dates, all critical dates)

weeks = Monday-start weeks from weekStart(earliest) through weekStart(latest)
```

Task bar weeks: overlap between [start, finish] and each week.  
Critical week: week containing critical date (red fill, overrides phase color).  
Critical outside duration: critical week still rendered (red).

---

## Entity relationship

```
Data row (1:N per project name, ordered)
    ↓ validate
Task object (0..1 per data row)
    ↓ group contiguous
Project block (1 header + N tasks)
    ↓ layout
Timeline rows + week matrix
```
