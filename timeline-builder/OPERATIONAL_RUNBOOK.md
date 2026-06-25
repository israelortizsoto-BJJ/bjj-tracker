# Timeline Builder — Operational Runbook

**Version:** 1.0  
**Tool location:** `timeline-builder/`  
**Primary output:** `Timeline.xlsx`  
**Validation artifact:** `ValidationReport.json`

---

## Quick reference

```bash
cd timeline-builder
source .venv/bin/activate

# Standard weekly run
python timeline_builder.py /path/to/smartsheet_export.csv

# With Google publish to standing dashboard
python timeline_builder.py /path/to/export.csv \
  --publish-google \
  --sheet-id YOUR_SPREADSHEET_ID

# CI / gate on clean data
python timeline_builder.py /path/to/export.csv --strict
```

| Exit code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Review output; distribute |
| 1 | General error | Check logs; see Troubleshooting |
| 2 | No valid tasks | Fix source export |
| 3 | Strict mode blocked | Fix validation errors; re-run |

---

## First-time setup

### 1. Install environment

```bash
cd timeline-builder
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest tests/ -q            # optional verification
```

### 2. Verify sample run

```bash
python timeline_builder.py sample_schedule.csv -o /tmp/Timeline.xlsx \
  --report /tmp/ValidationReport.json
```

Open `/tmp/Timeline.xlsx` in Excel. Confirm frozen panes, colors, and project sections.

### 3. Configure phase colors (optional)

Edit `colors.yaml` if your Smartsheet task names differ from defaults. Precedence is fixed in `color_matcher.py` (Delivery → Review → Edit/Post → Shoot → Prep → Concept).

### 4. Google Sheets setup (optional)

1. Enable Google Sheets API in Google Cloud Console  
2. Create service account; download JSON key  
3. Save to `credentials/google_service_account.json`  
4. Edit `google_config.yaml`:
   ```yaml
   credentials_path: credentials/google_service_account.json
   default_sheet_id: YOUR_STANDING_SHEET_ID   # optional
   ```
5. Share target Google Sheet with service account email (**Editor**)

**Security:** Never commit credential JSON to git.

### 5. Document org paths

Record in your team wiki (appendix at end of this runbook):

- Standard export folder
- Output delivery folder
- Standing Google Sheet ID (if used)

---

## Daily / weekly usage

### Standard workflow

```
1. Export schedule from Smartsheet (CSV or XLSX)
2. Run timeline_builder.py against export
3. Read operator summary
4. Review ValidationReport.json if skipped_rows > 0
5. Open Timeline.xlsx — spot-check 2–3 projects
6. Distribute Excel to stakeholders
7. (Optional) Confirm Google Sheet updated
```

### Recommended command (weekly standing sheet)

```bash
python timeline_builder.py "$EXPORT_PATH" \
  -o "$OUTPUT_DIR/Timeline_$(date +%Y%m%d).xlsx" \
  --report "$OUTPUT_DIR/ValidationReport_$(date +%Y%m%d).json" \
  --publish-google \
  --sheet-id "$STANDING_SHEET_ID"
```

### Operator summary — what to check

| Field | Action if non-zero / unexpected |
|-------|--------------------------------|
| Rows Skipped | Open validation report immediately |
| Errors | Review each skipped row; fix Smartsheet source |
| Warnings | Review; usually auto-corrected dates |
| Timeline Weeks | Sanity-check vs expected portfolio span |
| Google Publish Status | If `failed`, Excel is still valid—see Recovery |

### When to use `--strict`

| Use strict | Do not use strict |
|------------|-------------------|
| Automated CI/CD pipeline | Weekly operator preview |
| Gate before publish to exec dashboard | Exploratory first run on new export |
| Contractual requirement for zero data loss | When intentionally accepting partial timeline |

---

## Validation review procedure

When `Rows Skipped > 0` or stakeholders report missing tasks:

### Step 1 — Open `ValidationReport.json`

Key fields:

```json
{
  "total_rows": 100,
  "valid_rows": 97,
  "skipped_rows": 3,
  "error_count": 3,
  "skipped": [
    {
      "row_number": 42,
      "reason": "missing_start_date",
      "values": { "Project": "...", "Task Name": "..." }
    }
  ]
}
```

### Step 2 — Map row numbers to Smartsheet

Report `row_number` = spreadsheet row (row 1 is header). Row 42 = line 42 in the exported file.

### Step 3 — Fix source data

| Reason | Fix in Smartsheet |
|--------|-------------------|
| `missing_project` | Fill Project column |
| `missing_task_name` | Fill Task Name |
| `missing_start_date` | Add Start Date |
| `missing_finish_date` | Add Finish Date |
| `invalid_start_date` | Correct date format |
| `invalid_finish_date` | Correct date format |

Warnings (row still included):

| Reason | Action |
|--------|--------|
| `finish_before_start` | Dates auto-swapped; fix source if wrong |
| `invalid_critical_date` | Critical ignored; fix or clear date |

### Step 4 — Re-run and confirm

Re-export from Smartsheet after fixes. Confirm `skipped_rows` is acceptable before distribution.

---

## Google publishing workflow

### Create new sheet (first time)

```bash
python timeline_builder.py export.csv --publish-google
```

Copy URL from operator summary. Share with stakeholders.

### Update standing dashboard

```bash
python timeline_builder.py export.csv \
  --publish-google \
  --sheet-id 1AbC...existing_id
```

**Behavior:** Deletes existing `Timeline` tab and recreates it with fresh content.

### Publish failed but Excel succeeded

This is **by design**. Check operator summary:

```
Google Publish Status: failed
Google Publish Error:  ...
Timeline:              /path/to/Timeline.xlsx   ← still valid
```

Common causes:

| Error | Fix |
|-------|-----|
| Credentials not found | Check `google_config.yaml` path |
| Permission denied | Share sheet with service account email |
| API not enabled | Enable Google Sheets API in GCP |
| Timeline tab conflict | Re-run; tab is replaced each publish |

---

## Troubleshooting

### Generation failures

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Missing columns error | Smartsheet export renamed columns | Rename to exact required names |
| No valid tasks (exit 2) | All rows invalid | Fix export; check validation report |
| Wrong colors | Task name doesn't match patterns | Update `colors.yaml` patterns |
| Duplicate project sections | Same name in non-contiguous blocks | Expected behavior; reorder export if undesired |
| Critical date no red bar | Invalid critical date (warning) | Check warnings in report |
| Slow run (>60 s) | Very large portfolio | Normal up to ~500 tasks; wait or split export |

### Excel-specific

| Symptom | Resolution |
|---------|------------|
| Can't collapse projects | Use Excel desktop; enable row groups View |
| Dates show as numbers | Widen columns; format is `mmm d, yyyy` |
| Print unreadable | Wide timelines exceed one-page print; use screen review |

### Google Sheets-specific

| Symptom | Resolution |
|---------|------------|
| Formatting flat vs Excel | Expected limitation; use Excel for exec reviews |
| Row groups differ | Functional but not identical to Excel outline |
| Publish slow | Large timelines; allow extra minutes |

### Debug mode

```bash
python timeline_builder.py export.csv -v
```

---

## Recovery procedures

### R1 — Partial timeline generated (some rows skipped)

1. **Do not** manually edit `Timeline.xlsx` for missing tasks  
2. Read `ValidationReport.json`  
3. Fix Smartsheet source  
4. Re-export and re-run  
5. Replace previous output file

### R2 — Wrong output distributed

1. Identify run via `ValidationReport.json` → `source_file` and timestamp  
2. Fix source data if needed  
3. Re-run with dated output filename  
4. Notify stakeholders with corrected file  
5. Re-publish Google Sheet if applicable

### R3 — Strict mode blocked CI job

1. Download artifact `ValidationReport.json` from failed job  
2. Fix all rows listed in `skipped`  
3. Re-run with `--strict`  
4. Do not disable strict mode to bypass errors

### R4 — Google publish failed mid-week

1. Confirm `Timeline.xlsx` exists locally  
2. Distribute Excel immediately if deadline-critical  
3. Diagnose Google error from operator summary  
4. Re-run **publish only** (optional):
   ```python
   from pathlib import Path
   from google_sheets_publisher import load_google_config, publish_timeline_xlsx
   publish_timeline_xlsx(
       Path("Timeline.xlsx"),
       load_google_config(Path("google_config.yaml")),
       sheet_id="YOUR_SHEET_ID",
   )
   ```

### R5 — Credentials compromised

1. Revoke service account key in Google Cloud Console  
2. Issue new key; update `credentials/` path  
3. Do not commit new key to git  
4. Re-test publish with sample export

### R6 — Complete rollback to manual process

1. Stop using Timeline Builder for distribution  
2. Revert to prior manual Excel workflow  
3. Log issues in pilot feedback / roadmap  
4. Re-enter pilot after fixes (see `ACCEPTANCE_TEST_PLAN.md`)

---

## Health checks (monthly)

| Check | Command / action |
|-------|------------------|
| Tests pass | `pytest tests/ -q` |
| Sample run | `python timeline_builder.py sample_schedule.csv` |
| Dependencies current | `pip install -r requirements.txt` |
| Credentials valid | Test `--publish-google` on sample |
| Color rules current | Review new task naming in Smartsheet |

---

## Runbook appendix (fill in per organization)

| Item | Your value |
|------|------------|
| Primary operator | |
| Backup operator | |
| Smartsheet export path | |
| Output delivery path | |
| Standing Google Sheet ID | |
| Service account email | |
| Escalation contact | |
| Weekly run day/time | |

---

## Related documents

- `ACCEPTANCE_TEST_PLAN.md` — pilot validation
- `RELEASE_CHECKLIST.md` — release gate
- `PILOT_FEEDBACK_FORM.md` — feedback collection
- `PRODUCT_ROADMAP.md` — future priorities
- `README.md` — technical reference
