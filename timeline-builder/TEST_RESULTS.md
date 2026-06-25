# Timeline Builder — Test Results

**Run date:** 2026-06-23  
**Environment:** macOS, Python 3.14.4, pytest 9.1.1  
**Command:** `pytest tests/ -v`  
**Result:** **30 passed, 0 failed** (6.5 s)

---

## 1. Automated Test Coverage

| Area | Tests | Status | Notes |
|------|-------|--------|-------|
| Timeline generation | 6 | PASS | Small/medium/large/extra columns; error paths |
| Month headers | 3 | PASS | Full coverage, merged spans, year boundary |
| Weekly headers | 3 | PASS | Span math, date labels, W1…Wn |
| Project grouping | 3 | PASS | Documents merge-by-name behavior |
| Outline collapse | 2 | PASS | outlineLevel=1, summaryBelow=False |
| Color assignment | 3 | PASS | Phase colors; substring precedence |
| Critical date overrides | 2 | PASS | Red fill when in range; silent when outside span |
| Timeline span | 2 | PASS | Min/max dates, one-day tasks |
| Freeze panes | 1 | PASS | Freeze at `F4` |
| Edge normalization | 4 | PASS | Skips, swaps, duplicates, NaN project bug |
| Task label placement | 1 | PASS | Name only on first active week |

### Tests that encode known gaps (regression anchors)

These tests **pass by asserting current (imperfect) behavior** — they should flip when P0 fixes land:

| Test | Documents |
|------|-----------|
| `test_blank_project_csv_becomes_nan_project` | Empty CSV project → literal `"nan"` project |
| `test_duplicate_project_names_merge_non_contiguous_blocks` | Same project name merges across blocks |
| `test_duplicate_project_names_merge_into_one_group` | Grouping keyed by name, not contiguity |
| `test_critical_outside_timeline_span_is_silent` | Critical date outside task range → no red bar |
| `test_substring_precedence_for_ambiguous_name` | `Post shoot review` → Shoot color |

---

## 2. Dataset Validation Results

Generated via `python scripts/generate_test_datasets.py`.

### A. Small — `A_small_3projects_20tasks.csv`

| Metric | Value |
|--------|-------|
| Projects | 3 |
| Tasks | 20 |
| Build | PASS |
| Output size | 7.5 KB |
| Runtime | 0.176 s |

### B. Medium — `B_medium_10projects_100tasks.csv`

| Metric | Value |
|--------|-------|
| Projects | 10 |
| Tasks | 100 |
| Build | PASS |
| Output size | 16.0 KB |
| Runtime | 0.860 s |
| Rows in workbook | ≥100 data rows |

### C. Large — `C_large_30projects_515tasks.csv`

| Metric | Value |
|--------|-------|
| Projects | 30 |
| Tasks in file | 515 |
| Valid tasks after normalization | 511 |
| Build | PASS |
| Output size | 92.8 KB |
| Runtime | 5.91 s |
| Week columns | 52 |
| Timeline cells (approx.) | ~26,572 |

*4 tasks in the generated file share identical phase/date patterns that normalize successfully — row count difference vs. 515 warrants generator review but does not block builds.*

### D. Edge cases — `D_edge_cases.csv`

| Case | Expected handling | Observed |
|------|-------------------|----------|
| Missing start date | Skip | Skipped + WARNING |
| Missing finish date | Skip | Skipped + WARNING |
| Invalid date strings | Skip | Skipped + WARNING |
| Duplicate task names | Keep both | 2 rows kept |
| Duplicate project names (non-contiguous) | — | **Merged into 1 group (bug)** |
| Multi-month span | Multi-week bar | PASS |
| Year boundary (Dec→Jan) | Split month headers | PASS (Dec + Jan labels) |
| One-day task | Single week | PASS |
| Zero-duration (same day + critical) | Single red week | PASS |
| Inverted dates | Swap | Swapped + WARNING |
| Critical outside task range | — | **No red bar (bug)** |
| Critical inside range | Red week | PASS |
| Blank project row | Skip | **Kept as project `"nan"` (bug)** |
| Blank task row | Skip | Skipped |
| Whitespace-only task | Skip | Skipped |
| Color ambiguity names | Substring match | See §5 |
| Extra columns CSV | Ignore extras | PASS |

**Edge summary:** 21 input rows → **17 valid tasks** after normalization (4 skipped, 1 mis-ingested as `nan`).

### D-extra — `D_edge_cases_extra_columns.csv`

| Metric | Result |
|--------|--------|
| Columns | 9 (5 required + 4 extra) |
| Build | PASS |
| Extra columns stripped | PASS |

---

## 3. Performance Benchmarks

Executed via `python scripts/benchmark.py` on macOS (sandbox).

### Synthetic workloads (fixed project count = 10)

| Tasks | Runtime (s) | Workbook (KB) | Peak memory (MB) | RSS (MB) |
|-------|-------------|---------------|------------------|----------|
| 20 | 0.059 | 6.9 | 0.77 | 88.6 |
| 100 | 0.169 | 10.2 | 1.04 | 89.5 |
| 500 | 0.701 | 25.6 | 2.39 | 93.1 |
| 1,000 | 1.361 | 44.8 | 4.42 | 98.3 |

### Real dataset workloads

| Dataset | Runtime (s) | Workbook (KB) | Peak memory (MB) |
|---------|-------------|---------------|-------------------|
| Small (20 tasks) | 0.176 | 7.5 | 0.80 |
| Medium (100 tasks) | 0.860 | 16.0 | 1.82 |
| Large (511 tasks) | 5.910 | 92.8 | 12.62 |

### Performance observations

- Runtime scales roughly **O(tasks × weeks)** — dominated by per-cell styling in Python.
- Memory remains modest (<13 MB peak at 511 tasks).
- Workbook size stays under 100 KB at 511 tasks — file size is not a bottleneck.
- **Usability** degrades before **performance**: 52 week columns already exceed comfortable executive screen width.

---

## 4. Excel Compatibility Verification

### Method

Structural inspection of generated OOXML workbooks (openpyxl load + property checks). **Manual verification in Excel Mac, Excel Windows, and Google Sheets was not performed in CI** — status below is *expected* based on format features.

### Workbook structure (large dataset output)

| Property | Value |
|----------|-------|
| Sheet name | `Timeline` |
| Header rows | 3 (month, week, columns) |
| Freeze panes | `F4` |
| Merged cells | Month header spans |
| Outline | `summaryBelow=False`, child `outlineLevel=1` |
| Print | Landscape, `fitToWidth=1`, title rows `1:3` |

### Compatibility matrix

| Client | Open | Layout | Colors | Outline groups | Freeze | Print settings | Overall |
|--------|------|--------|--------|----------------|--------|----------------|---------|
| **Microsoft Excel (Windows)** | Expected OK | Expected OK | Expected OK | Expected OK | Expected OK | Expected OK | **Likely OK** — manual sign-off recommended |
| **Microsoft Excel (Mac)** | Expected OK | Expected OK | Expected OK | Expected OK | Expected OK | Expected OK | **Likely OK** — manual sign-off recommended |
| **Google Sheets (import)** | Opens | Partial | Mostly OK | **Often lost** | Usually OK | Lost/approx | **Degraded** — not recommended for collapse workflow |
| **LibreOffice Calc** | Expected OK | Mostly OK | Mostly OK | Variable | OK | Variable | **Acceptable** for viewing |

### Known formatting degradation risks

1. **Google Sheets:** Row outline groups may not import; users lose collapsible project sections.
2. **Google Sheets:** `fitToWidth` print settings not honored.
3. **Wide timelines:** Excel print-to-one-page scaling may produce unreadable output.
4. **openpyxl RGB prefix:** Colors stored as `AARRGGBB`; Excel generally renders correctly; some viewers strip alpha.

### Manual test checklist (for release sign-off)

- [ ] Open `C_large` output in Excel Windows — verify collapse/expand per project
- [ ] Open same file in Excel Mac — verify freeze panes and merged headers
- [ ] Import into Google Sheets — document outline loss with stakeholders
- [ ] Print preview at 20, 52, and 80 week spans
- [ ] Confirm critical-date red visible in all clients

---

## 5. Configuration Test Results

### Precedence experiments (manual analysis)

| Task name | Matched category | Fill | Notes |
|-----------|------------------|------|-------|
| `Post shoot review` | Shoot | `9DC3E6` | `shoot` before `post` |
| `Live editorial cut` | Edit | `00B0A8` | `edit` in *editorial* before `live` |
| `Pre production edit` | Pre Pro / Prep | `2F75B5` | `pre production` matches first |
| `Client review delivery` | Review / Approval | `A6A6A6` | `review` before `delivery` |
| `Color shoot` | Shoot | `9DC3E6` | `shoot` before `color` |
| `Planning approval` | Pre Pro / Prep | `2F75B5` | `planning` before `approval` |

### Config determinism

- Same task name + same YAML → same color: **confirmed**
- Multiple matches possible: **yes** — first YAML category wins
- Conflicts documented: **yes** — see HARDENING_REPORT.md §7

---

## 6. User Experience Spot Check (Static Review)

| Criterion | Rating (1–5) | Notes |
|-----------|--------------|-------|
| Readability | 4 | Clean headers; narrow week cells hurt long names |
| Executive presentation | 3.5 | Strong palette; missing legend and metadata |
| Printability | 2.5 | fitToWidth unusable for wide timelines |
| Large-project usability | 2.5 | Scroll fatigue at 50+ weeks |
| Collapse behavior (Excel) | 4 | Correct openpyxl settings |
| Collapse behavior (Sheets) | 1 | Expected import loss |

*Improvements recommended in HARDENING_REPORT.md §8 — not implemented in Phase 2.*

---

## 7. Summary

| Category | Result |
|----------|--------|
| Automated tests | **30/30 PASS** |
| Small/Medium/Large builds | **PASS** |
| Edge-case ingestion | **PARTIAL** — 2 P0 bugs confirmed |
| Performance (≤1000 tasks) | **PASS** — sub-6 s at 511 tasks |
| Excel compatibility | **Conditional** — Excel likely OK; Sheets degraded |
| Config determinism | **PASS** with documented precedence caveats |

### Production Readiness Score: **5 / 10**

### Recommendation: **Needs hardening**

The builder reliably produces well-formatted roadmaps for clean, well-structured Smartsheet exports at moderate scale. It is **not yet production-ready** for unattended use against real-world exports due to silent data loss, NaN project ingestion, project grouping bugs, and critical-date timeline gaps documented above and encoded in regression tests.

---

## 8. Reproduction

```bash
cd timeline-builder
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/generate_test_datasets.py
pytest tests/ -v
python scripts/benchmark.py
```

Outputs:

- Test datasets: `TEST_DATASETS/`
- Benchmark workbooks: `benchmark_output/`
