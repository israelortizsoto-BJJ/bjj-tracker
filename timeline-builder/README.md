# Timeline Builder

Convert Smartsheet schedule exports (CSV or XLSX) into a presentation-quality project roadmap Excel workbook.

## Features

- Groups tasks by **contiguous project blocks** with collapsible outline groups
- Weekly timeline spanning earliest start, latest finish, and all critical dates
- Merged month headers across weekly columns
- Deterministic word-boundary color matching by task phase
- Critical dates highlighted in red (including milestones outside task duration)
- Frozen project columns for executive review
- Validation report (`ValidationReport.json`) for every run
- Strict mode for CI/CD pipelines
- Optional Google Sheets publishing (`--publish-google`)

## Architecture

```
Smartsheet CSV/XLSX
        │
        ▼
 timeline_builder.py ──► ValidationReport.json
        │
        ▼
   Timeline.xlsx  ──────► google_sheets_publisher.py (optional)
        │                        │
        │                        ▼
        │                 Google Sheet (Timeline tab)
        ▼
   Excel deliverable (primary)
```

Excel remains the primary output. Google Sheets is an optional delivery channel that reads the generated workbook and publishes it via the Google Sheets API.

| Module | Role |
|--------|------|
| `timeline_builder.py` | Validation, timeline generation, CLI |
| `validation.py` | Input validation and report |
| `color_matcher.py` | Deterministic phase colors |
| `google_sheets_publisher.py` | Optional Google Sheets publish |
| `colors.yaml` | Phase color patterns |
| `google_config.yaml` | Google API credentials and publish options |

## Requirements

- Python 3.10+
- pandas
- openpyxl
- PyYAML
- google-api-python-client (Google Sheets publishing)
- google-auth (Google Sheets publishing)

## Setup

```bash
cd timeline-builder
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
python timeline_builder.py sample_schedule.csv
```

This writes `Timeline.xlsx` and `ValidationReport.json` in the current directory, then prints an operator summary.

### Options

| Flag | Description |
|------|-------------|
| `-o`, `--output` | Output workbook path (default: `Timeline.xlsx`) |
| `-c`, `--config` | Color mapping config (default: `colors.yaml`) |
| `--report` | Validation report path (default: `ValidationReport.json` next to output) |
| `--strict` | Exit non-zero and skip timeline when validation errors exist |
| `--publish-google` | Publish `Timeline.xlsx` to Google Sheets after generation |
| `--sheet-id` | Existing Google Spreadsheet ID to update (optional) |
| `--google-config` | Google publishing config (default: `google_config.yaml`) |
| `-v`, `--verbose` | Enable debug logging |

### Examples

```bash
# Standard run with validation report
python timeline_builder.py sample_schedule.csv

# CI/CD: fail on any invalid rows
python timeline_builder.py exports/schedule.csv --strict

# Custom output locations
python timeline_builder.py exports/q2_schedule.xlsx \
  -o deliverables/Q2_Timeline.xlsx \
  --report deliverables/ValidationReport.json

# Generate and publish to a new Google Sheet
python timeline_builder.py sample_schedule.csv --publish-google

# Update an existing Google Sheet (Timeline tab replaced)
python timeline_builder.py sample_schedule.csv \
  --publish-google \
  --sheet-id YOUR_SPREADSHEET_ID
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — timeline generated |
| 1 | General error (missing file, config, etc.) |
| 2 | No valid tasks in input |
| 3 | Strict mode — validation errors prevented timeline generation |

## Input format

Export your Smartsheet schedule with these columns:

| Column | Required | Description |
|--------|----------|-------------|
| Project | Yes | Project or program name |
| Task Name | Yes | Task or phase name (drives color rules) |
| Start Date | Yes | Task start date |
| Finish Date | Yes | Task end date |
| Critical Date | No | Milestone date; overrides bar color to red |

Supported file types: `.csv`, `.xlsx`, `.xlsm`, `.xls`

Extra columns in the export are ignored.

## Validation

Every run produces `ValidationReport.json` documenting:

- Total, valid, and skipped row counts
- Warning and error counts
- Per-row reasons and source values for skipped rows
- Whether the timeline was generated

Schema: `ValidationReport.schema.json`

### Validation reasons

| Reason | Kind | Behavior |
|--------|------|----------|
| `missing_project` | error | Row skipped |
| `missing_task_name` | error | Row skipped |
| `missing_start_date` | error | Row skipped |
| `missing_finish_date` | error | Row skipped |
| `invalid_start_date` | error | Row skipped |
| `invalid_finish_date` | error | Row skipped |
| `invalid_critical_date` | warning | Task kept; critical date ignored |
| `finish_before_start` | warning | Dates auto-corrected; task kept |

In default mode, valid rows produce a timeline even when some rows are skipped. In `--strict` mode, any error prevents timeline generation.

## Output layout

```
Row 1  → Month headers (merged across weeks)
Row 2  → Week date ranges
Row 3  → Column headers (Project, Task Name, dates, W1…Wn)
Row 4+ → Project section headers + collapsible task rows
```

- Columns A–E: project metadata (frozen)
- Columns F+: weekly roadmap bars
- Task names appear only in the first active week of each bar
- Non-contiguous rows with the same project name produce separate project sections

## Color matching

Phase colors are assigned using **word-boundary matching** with fixed precedence (first match wins):

1. Delivery / Air / Live
2. Review / Approval
3. Edit / Post / VFX / Color
4. Shoot
5. Pre Pro / Prep
6. Concepting

Patterns match whole words only — `edit` does not match *editorial*. Edit `colors.yaml` to adjust patterns; precedence is defined in `color_matcher.py`.

Tasks with a **Critical Date** use red for that week’s bar. Critical milestones outside the task start/finish range still render on the timeline.

## Operator summary

After each run:

```
Timeline Generation Summary
---------------------------
Rows Processed:  20
Rows Included:   20
Rows Skipped:    0
Projects:        3
Timeline Weeks:  15
Warnings:        0
Errors:          0
Timeline:        Timeline.xlsx
ValidationReport: ValidationReport.json

Google Publish Status: published
Google Sheet URL:      https://docs.google.com/spreadsheets/d/...
Sheet Updated Time:    2026-06-23 14:30:00 UTC
```

Publishing failures do **not** prevent `Timeline.xlsx` or `ValidationReport.json` from being written.

## Google Sheets publishing

### Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **Google Sheets API** (APIs & Services → Library → Google Sheets API → Enable)
4. Create a **service account** (APIs & Services → Credentials → Create Credentials → Service Account)
5. Create a JSON key for the service account and save it to:
   ```
   timeline-builder/credentials/google_service_account.json
   ```
6. Copy `google_config.yaml` defaults or set `credentials_path` to your key file

### Share the target sheet

The service account email (in the JSON key, `client_email`) must have **Editor** access:

- **New sheet:** No sharing needed — the service account owns the created spreadsheet
- **Existing sheet:** Open the Google Sheet → Share → add the service account email as Editor

### Configuration (`google_config.yaml`)

```yaml
credentials_path: credentials/google_service_account.json
default_sheet_id: null   # or your default spreadsheet ID
publish:
  tab_name: Timeline
  create_title_prefix: "Timeline Roadmap - "
  preserve_formatting: true
  preserve_merged_cells: true
  preserve_frozen_panes: true
  preserve_row_groups: true
```

### Publishing workflow

```bash
# 1. Configure credentials (one-time)
# 2. Generate + publish in one command
python timeline_builder.py exports/schedule.csv --publish-google

# 3. Or update a standing executive dashboard sheet
python timeline_builder.py exports/schedule.csv \
  --publish-google \
  --sheet-id 1AbC...your_id
```

The publisher:

1. Reads the generated `Timeline.xlsx`
2. Creates a new spreadsheet **or** replaces the `Timeline` tab in an existing sheet
3. Uploads cell values, colors, merged headers, frozen panes, and row groups

### Google Sheets limitations

| Feature | Excel | Google Sheets |
|---------|-------|---------------|
| Primary deliverable | Yes | Optional copy |
| Merged month headers | Full support | Preserved via API |
| Frozen panes | Full support | Preserved via API |
| Row collapse groups | Native outline | Dimension groups (similar) |
| Print layout | Landscape fit-to-width | Not transferred |
| Complex borders | Per-cell | Not transferred |
| Very wide timelines | Usable with scroll | Same; API batch limits apply |

## Programmatic use

```python
from pathlib import Path
from timeline_builder import build_timeline

result = build_timeline(
    input_path=Path("exports/schedule.csv"),
    output_path=Path("Timeline.xlsx"),
    config_path=Path("colors.yaml"),
    strict=False,
    report_path=Path("ValidationReport.json"),
)

if result.output_path:
    print(f"Wrote {result.output_path}")
print(f"Skipped {result.report.skipped_rows} rows")

# Optional Google Sheets publish after generation
from google_sheets_publisher import load_google_config, publish_timeline_xlsx

if result.output_path:
    publish = publish_timeline_xlsx(
        result.output_path,
        load_google_config(Path("google_config.yaml")),
        sheet_id="YOUR_SPREADSHEET_ID",  # omit to create new sheet
    )
    print(publish.sheet_url or publish.error)
```

## Testing

```bash
pytest tests/ -v
python scripts/generate_test_datasets.py
```

Test datasets live in `TEST_DATASETS/`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing columns error | Ensure Smartsheet export uses exact column names |
| Rows missing from timeline | Open `ValidationReport.json` for row-level reasons |
| CI fails with exit 3 | Fix source data or remove `--strict` for preview runs |
| Wrong colors | Check precedence in README; adjust patterns in `colors.yaml` |
| Duplicate project sections | Expected when same project name appears in non-contiguous blocks |
| Google publish failed | Check credentials path, API enablement, and sheet sharing |
| Permission denied (Google) | Share the sheet with the service account email as Editor |

## Production readiness

See `PRODUCTION_READINESS.md` for the current readiness assessment.
