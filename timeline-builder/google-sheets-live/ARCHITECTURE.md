# Architecture — Live Timeline Planner (Option C)

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Google Spreadsheet                                           │
│                                                              │
│  ┌──────────┐    validate     ┌─────────────────────────┐   │
│  │   Data   │ ───────────────►│ Validation tab          │   │
│  │ (edit)   │                 └─────────────────────────┘   │
│  └────┬─────┘                                                │
│       │ onEdit (debounced) / Refresh Timeline menu           │
│       ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Apps Script engine                                    │   │
│  │  Validation.gs → TimelineEngine.gs → ColorMatcher.gs│   │
│  │  Config.gs (colors + theme)                         │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          ▼                                   │
│  ┌──────────┐         ┌──────────┐                          │
│  │  Config  │         │ Timeline │ (protected)              │
│  └──────────┘         └──────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Design principles

1. **Data is the source of truth** — PMs never edit the Timeline tab for schedule changes.  
2. **Timeline is derived** — rebuilt from Data on each refresh (render-at-build, inside Sheets).  
3. **Python is reference only** — algorithms ported selectively; no runtime dependency on Python.  
4. **MVP first** — prove edit → see bars update; expand parity later.

## Module map

| File | Responsibility |
|------|----------------|
| `Constants.gs` | Sheet names, column layout, category precedence order |
| `Utils.gs` | Date parsing, week math, formatting |
| `Config.gs` | Load/write Config tab (categories + theme) |
| `ColorMatcher.gs` | Word-boundary color rules (from `color_matcher.py`) |
| `Validation.gs` | Row validation + Validation tab (from `validation.py`) |
| `TimelineEngine.gs` | Week grid, layout, merges, groups, protection |
| `SheetSetup.gs` | `setupLivePlanner()` initial workbook |
| `Main.gs` | Menu, `refreshTimeline()`, debounced triggers |

## Refresh pipeline

```
refreshTimeline()
    │
    ├─ loadConfig()
    ├─ validateDataSheet()  → writeValidationSheet()
    ├─ buildTimelineSheet()   → clear, write grid, merge, freeze, group, protect
    └─ update validation (timeline_generated = Yes)
```

## Trigger model

| Trigger | Handler | Behavior |
|---------|---------|----------|
| Manual | `refreshTimeline` | Immediate full rebuild |
| Installable onEdit | `handleDataEdit` | Schedules debounced rebuild when cols C–E change on Data |
| Time-based (one-shot) | `debouncedRefreshTimeline` | Fires ~2s after last edit; calls `refreshTimeline` |

**Note:** Simple `onEdit` triggers cannot call `ScriptApp.newTrigger`. Debounce requires **Install edit triggers** (menu item or `setupLivePlanner`).

## Comparison to Python generator

| Capability | Python v1 | Sheets MVP |
|------------|-----------|------------|
| Input | Smartsheet file | Data tab |
| Output | Timeline.xlsx | Timeline tab |
| Live date edit | No | Yes |
| ValidationReport.json | Yes | Validation tab |
| Strict mode | Yes | No (MVP) |
| Google publish | Static copy | Native sheet |
| CLI / CI | Yes | No |

## Security

- Timeline tab: warning-only protection (discourages edits, not a security boundary)  
- Config tab: warning-only protection  
- Service account not required for MVP (runs as the user who authorizes the script)  
- For org deployment: use shared team sheet + script owned by trusted editor account  

## Limits (Google Apps Script)

- ~6 min execution time per run  
- ~10M cell touches per run (practical limit lower)  
- Recommended MVP scale: **≤200 tasks**, **≤60 week columns**  
- Larger portfolios: batch formatting (future Phase A item)

## Extension points (post-MVP)

- Smartsheet import → Data tab (Python or Script)  
- Snapshot export to XLSX/PDF  
- Sidebar validation UI  
- Config validation schema  
- `handleDataEdit` expand to Project/Task name changes triggering refresh
