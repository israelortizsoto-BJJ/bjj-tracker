# Timeline Builder — Hardening Report

**Audit date:** 2026-06-23  
**Scope:** Phase 2 production-readiness review (no new features, no redesign)  
**Auditor stance:** Independent senior-engineering review; findings prioritized by real-world Smartsheet export risk.

---

## 1. Current Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Input file     │     │  timeline_       │     │  Timeline.xlsx        │
│  CSV / XLSX     │────▶│  builder.py      │────▶│  (openpyxl output)    │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  colors.yaml     │
                        │  (phase colors)  │
                        └──────────────────┘
```

### Module structure

| Component | Responsibility |
|-----------|----------------|
| `read_schedule()` | Load CSV/XLSX via pandas; validate required columns; strip column names |
| `normalize_tasks()` | Parse dates, skip invalid rows, swap inverted dates, build `TaskRow` list |
| `build_week_columns()` | Monday-based week grid from min(start) to max(finish) |
| `group_tasks_by_project()` | Dict keyed by project name; preserve first-seen project order |
| `task_style()` | Substring color matching against `colors.yaml` categories |
| `build_workbook()` | All Excel layout, styling, merges, outline groups, freeze panes |
| `build_timeline()` | Orchestrator: config → parse → build → save |

### Dependencies

- **pandas** — file I/O, date coercion
- **openpyxl** — XLSX generation (OOXML)
- **PyYAML** — color config

### Execution model

- Single-process, synchronous, in-memory workbook build
- CLI entry point with exit codes; no server, no scheduler, no cache

---

## 2. Data Flow Overview

```
Smartsheet export
    │
    ▼
pandas.read_csv / read_excel
    │
    ▼
Column filter → [Project, Task Name, Start Date, Finish Date, Critical Date]
    │
    ▼
Row iteration (normalize_tasks)
    ├─ skip: empty project/task (BUG: NaN → "nan")
    ├─ skip: missing start or finish
    ├─ swap: finish < start
    └─ parse: critical date (optional)
    │
    ▼
Fail if zero valid tasks
    │
    ▼
Compute week columns (Monday start, week containing min/max dates)
    │
    ▼
Group tasks by project name (unique key)
    │
    ▼
For each project:
    ├─ Write project header row
    └─ For each task:
        ├─ Write info columns A–E
        ├─ For each week column: empty | colored bar | critical red
        └─ Set outlineLevel = 1
    │
    ▼
Save Timeline.xlsx
```

---

## 3. Assumptions Currently Made by the Code

| # | Assumption | Risk if violated |
|---|------------|------------------|
| A1 | Column headers match exactly (after strip): `Project`, `Task Name`, `Start Date`, `Finish Date`, `Critical Date` | Hard failure; common Smartsheet renames break the pipeline |
| A2 | Dates are parseable by `pd.to_datetime` or are already datetime objects | Ambiguous US/EU strings parse wrong or rows dropped silently |
| A3 | CSV is UTF-8 | Non-UTF-8 exports fail or corrupt text |
| A4 | Project name is a stable grouping key | Non-contiguous blocks with same name merge incorrectly |
| A5 | Task Name alone determines phase color | Substring false positives (e.g. `edit` in *editorial*) |
| A6 | Timeline span = min(start) … max(finish) only | Critical dates outside that range never appear on the grid |
| A7 | Weeks start on Monday | Misalignment vs Smartsheet/calendar settings using Sunday or rolling 7-day |
| A8 | Month headers label the **Monday** of each week | Weeks spanning month boundaries show the earlier month only |
| A9 | One output sheet named `Timeline` | No multi-sheet or template customization |
| A10 | Users accept warnings on stderr for dropped rows | Production pipelines lose data without structured error reporting |
| A11 | `colors.yaml` is present, valid YAML, and has expected keys | Malformed config crashes at runtime |
| A12 | `.xls` legacy exports work via pandas/openpyxl stack | Old `.xls` may require extra engines not in requirements |

---

## 4. Failure Points

### 4.1 Data ingestion (Critical)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Empty Project cell (pandas `NaN`) | Becomes literal project `"nan"`; row kept | **Critical** |
| Empty Task Name (`NaN`) | Becomes `"nan"` task name | **High** |
| Missing start or finish | Row skipped; warning logged | **High** (silent loss) |
| Invalid date strings | Row skipped; warning logged | **High** |
| Inverted start/finish | Dates swapped; warning logged | Medium |
| All rows invalid | `ValueError`; no output | OK |
| Extra columns | Ignored (safe) | OK |
| Missing required column | `ValueError` with column list | OK |
| Unsupported extension | `ValueError` | OK |

### 4.2 Grouping & layout (High)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Same project name in non-contiguous blocks | Merged into one section; middle projects break visual order | **High** |
| Case-different project names (`Alpha` vs `alpha`) | Treated as separate projects | Medium |
| Duplicate task names | Both rendered; no dedup | OK (expected) |
| Project with all tasks invalid | Project omitted entirely | Medium |

### 4.3 Timeline logic (High)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Critical date outside task start/finish | Shown in column E but **no red bar** (week not in grid or not active) | **High** |
| Critical date in active range | Only that week red; other weeks use phase color | OK (by design) |
| One-day / zero-duration task | Single week bar | OK |
| Multi-month / cross-year tasks | Bar spans weeks correctly | OK |
| Very long schedules (multi-year) | Week column count grows linearly; performance & usability degrade | Medium |

### 4.4 Color rules (Medium)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Multiple pattern matches | First category in YAML order wins | Medium (non-obvious) |
| Short patterns (`edit`, `post`, `air`, `live`, `prep`) | Match inside unrelated words | Medium |
| `Post shoot review` | Matches **Shoot** (`shoot`) not Edit (`post`) | Medium |
| `Live editorial cut` | Matches **Edit** (`edit` in *editorial*) not Delivery (`live`) | Medium |
| Unmatched task name | Gray default fill | OK |

### 4.5 Config (Medium)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Missing `categories` key | Empty list; all tasks gray | Medium |
| Missing `fill` on category | `KeyError` crash | High |
| Invalid hex color | openpyxl may accept or render wrong | Low |
| No schema validation | Runtime failures only | Medium |

### 4.6 Excel output (Medium)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| Outline groups | Written via openpyxl; client support varies (esp. Google Sheets) | Medium |
| Merged month headers | Standard OOXML; generally OK in Excel | Low |
| Freeze panes at `F4` | Standard; OK in Excel | Low |
| `fitToWidth=1` print scaling | May over-shrink on very wide timelines | Medium |
| File locked / path not writable | Python exception; exit code 1 | OK |

### 4.7 Operational (High)

| Failure | Current behavior | Severity |
|---------|------------------|----------|
| No run summary artifact | User must read stderr warnings | **High** |
| No idempotency/version stamp in output | Hard to audit which input produced a file | Medium |
| No input checksum in logs | Hard to debug stale outputs | Medium |
| Broad `except Exception` in CLI | Masks error class in exit code (always 1) | Low |

---

## 5. Scalability Concerns

### Computational complexity

Cell writes ≈ **tasks × weeks** for timeline columns, plus fixed header overhead.

| Scale | Tasks | Weeks (typ.) | Timeline cells | Observed runtime | Workbook size |
|-------|-------|--------------|----------------|------------------|---------------|
| Small | 20 | ~15 | ~300 | 0.06–0.18 s | ~7 KB |
| Medium | 100 | ~20 | ~2,000 | 0.17–0.86 s | ~16 KB |
| Large | 515 | ~52 | ~27,000 | ~5.9 s | ~93 KB |
| Stress | 1,000 | ~40+ | ~40,000+ | ~1.4 s (synthetic) | ~45 KB |

*Synthetic benchmarks use compressed date ranges; real Smartsheet exports with multi-year spans increase week count and runtime significantly.*

### Limits

- **Excel columns:** 16,384 max. At 1 week per column, ~136 years of weeks — not a practical blocker.
- **Excel rows:** 1,048,576 — fine for task counts under ~1M.
- **Memory:** Peak ~12 MB at 515 tasks (measured); scales with cell count.
- **Usability cliff:** 50+ week columns exceed typical executive screen width; horizontal scroll degrades presentation value before technical limits.

### Bottleneck

Per-cell Python loops in `build_workbook()` — no batch write, no write-only optimization, no parallelism.

---

## 6. Maintainability Concerns

| Issue | Impact |
|-------|--------|
| Monolithic `build_workbook()` (~290 lines) | Hard to test layout subsections in isolation |
| No config schema / version field | Breaking YAML changes undetected until runtime |
| Warnings via `logging` only | No contract for downstream automation |
| Magic row numbers (1–3 headers, data row 4) | Fragile if layout changes |
| Limited type validation on config load | KeyError-prone |
| No pinned dependency lockfile in repo | Reproducible builds depend on pip resolution |
| Tests document bugs as “known behavior” | Good for audit, but bugs may become permanent fixtures |

---

## 7. Configuration Review (`colors.yaml`)

### Determinism

- **Deterministic** for a fixed YAML file and task name: same input → same color.
- Order of categories in YAML is the precedence rule (documented in comments).

### Conflicts

| Conflict type | Example | Winner today |
|---------------|---------|--------------|
| Multiple patterns in one name | `Post shoot review` | Shoot (`shoot`) — Shoot listed before Edit |
| Pattern substring overlap | `editorial` | Edit (`edit`) — listed before Delivery (`live`) |
| Phase vs critical | Task with critical date | Critical red on critical week only |
| Short generic tokens | `air`, `live`, `post` | First matching category in file order |

### Multiple matches

- **Always possible** with substring matching.
- Only the **first matching category** applies; no scoring, word boundaries, or longest-match logic.

### Recommendations (do not implement in Phase 2)

1. Add `config_version: 1` and validate on load.
2. Document precedence explicitly in README: *“First YAML category whose pattern appears anywhere in Task Name wins.”*
3. Prefer longer/more specific patterns first; consider word-boundary matching for tokens ≤4 chars.
4. Add optional `exclude_patterns` or priority overrides for known ambiguous names.
5. Ship a `colors.schema.json` or pydantic model for fail-fast validation.

---

## 8. User Experience Review (Recommendations Only)

### Readability

- **Strengths:** Clear column headers, alternating row fills, phase colors, project headers.
- **Weaknesses:** Task names inside narrow week cells truncate; long names wrap but column width is fixed at 11.

### Executive presentation quality

- **Strengths:** Landscape print setup, title rows, cohesive palette, frozen metadata columns.
- **Weaknesses:** No legend for colors; no “generated on” footer; month labels can mislabel boundary weeks.

### Printability

- `fitToWidth=1` forces entire width onto one printed page — unreadable beyond ~20–30 weeks.
- No explicit print area or repeated left columns beyond freeze panes.

### Large-project usability

- 515 tasks × 52 weeks requires extensive horizontal scroll even with freeze panes.
- Outline collapse helps per project but no top-level “collapse all” control is generated.
- No filtering, search, or summary row (counts, date range).

### Expand/collapse behavior

- openpyxl sets `summaryBelow=False` (header above detail) — correct for Excel.
- **Google Sheets:** row grouping often lost or flattened on import.
- **Excel Mac/Windows:** expected to work (structural validation only — see TEST_RESULTS.md).

### UX improvements (deferred)

1. Add color legend sheet.
2. Add generation metadata row/sheet.
3. Tune print scaling for wide timelines (multi-page horizontal).
4. Widen first active week column dynamically for labels.
5. Optional “compact mode” hiding info columns C–E for screen view.

---

## 9. Excel Compatibility (Structural Assessment)

Manual open-in-Excel verification was **not performed in this audit environment**. Assessment is based on OOXML structure inspection and known openpyxl/client behavior.

| Feature | Excel Win/Mac (expected) | Google Sheets import | Degradation risk |
|---------|------------------------|----------------------|------------------|
| Freeze panes (`F4`) | Supported | Usually preserved | Low |
| Merged month headers | Supported | Mostly preserved | Low |
| Cell fills / fonts | Supported | Mostly preserved | Low–Med |
| Row outline groups | Supported | Often **lost** | **High** for Sheets |
| Print title rows | Supported | Ignored | Med |
| `fitToWidth` | Supported | Not reliable | Med |
| Date number formats | Supported | May show serials if locale differs | Low |
| Column widths | Supported | Approximate | Low |

**Recommendation:** Treat Google Sheets as preview-only unless import is explicitly tested and accepted.

---

## 10. Recommended Fixes (Prioritized)

### P0 — Before production use

1. **Fix NaN/blank project and task validation** — treat pandas NA as empty; reject or skip `"nan"` literal.
2. **Emit structured run report** — JSON/CSV manifest: rows read, kept, skipped, reasons.
3. **Include critical dates in timeline span** — `min(start, critical)` / `max(finish, critical)` for week range.
4. **Group projects by consecutive blocks**, not global project name key.

### P1 — High ROI hardening

5. Fail or warn when >N rows skipped (configurable threshold).
6. Config schema validation with clear error messages.
7. Column name alias map (e.g. `Start` → `Start Date`) for Smartsheet variants.
8. Document color precedence and add regression tests for ambiguous names.

### P2 — Operational maturity

9. `--dry-run` validation mode.
10. Output metadata (source file hash, timestamp, tool version).
11. Performance: write-only workbook mode or reduced border application for large files.
12. Dependency lockfile (`requirements.lock` or `uv.lock`).

---

## 11. Production Readiness Verdict

| Metric | Score |
|--------|-------|
| **Production Readiness** | **5 / 10** |
| **Recommendation** | **Needs hardening** |

### Top 5 risks

1. **Silent row drops** — invalid/missing dates skipped with only log warnings; no user-facing manifest.
2. **NaN → `"nan"` project** — blank Smartsheet cells create a bogus project group.
3. **Non-contiguous duplicate project names merged** — breaks Smartsheet sort/group semantics.
4. **Critical dates outside task duration invisible on roadmap** — milestone column shows date but no red bar.
5. **Non-deterministic color perception** — substring rules produce surprising colors for compound task names.

### Top 5 highest-ROI improvements

1. Input validation hardening (NA handling + skip manifest).
2. Consecutive-block project grouping.
3. Timeline span includes critical dates.
4. Config schema validation + documented precedence.
5. Structured CLI exit codes (`2` validation, `3` config, etc.) and `--strict` mode.

### Final recommendation

**Needs hardening** — core layout and happy-path exports work, and performance is acceptable through ~500 tasks, but real-world Smartsheet data quality issues are handled inconsistently, with data loss and misleading grouping that would undermine executive-facing deliverables. Do **not** deploy as production infrastructure until P0 fixes are implemented and validated against `TEST_DATASETS/`.

---

## Appendix: Test Assets

| Asset | Location |
|-------|----------|
| Small (3 projects, 20 tasks) | `TEST_DATASETS/A_small_3projects_20tasks.csv` |
| Medium (10 projects, 100 tasks) | `TEST_DATASETS/B_medium_10projects_100tasks.csv` |
| Large (30 projects, 511 valid tasks) | `TEST_DATASETS/C_large_30projects_515tasks.csv` |
| Edge cases | `TEST_DATASETS/D_edge_cases.csv` |
| Extra columns variant | `TEST_DATASETS/D_edge_cases_extra_columns.csv` |
| Automated tests | `tests/test_timeline_builder.py` (30 tests) |
| Benchmark script | `scripts/benchmark.py` |

See **TEST_RESULTS.md** for execution results and detailed pass/fail analysis.
