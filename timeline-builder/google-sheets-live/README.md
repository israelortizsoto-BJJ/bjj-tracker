# Live Timeline Planner — Google Sheets MVP

Google Sheets + Apps Script live planning tool. PMs edit dates on the **Data** tab; the **Timeline** tab rebuilds automatically.

The Python Timeline Builder (`../timeline_builder.py`) remains the **visual specification** — this project ports the MVP subset to Apps Script.

## Quick start

1. Create a new Google Spreadsheet  
2. Extensions → Apps Script  
3. Copy all files from `src/*.gs` into the script project (one file per module, or merge into `Code.gs`)  
4. Copy `appsscript.json` settings (Runtime: V8)  
5. Run **`setupLivePlanner`** once (authorize when prompted)  
6. Edit dates on **Data** → timeline refreshes in ~2 seconds (or use **Timeline Planner → Refresh Timeline**)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for clasp and team rollout.

## Sheets

| Tab | Editable | Purpose |
|-----|----------|---------|
| **Data** | Yes | PM schedule input |
| **Config** | Careful | Color rules + theme |
| **Timeline** | Protected | Executive roadmap (auto-built) |
| **Validation** | Read-only | Row issues and summary |

## Menu

**Timeline Planner**

- Refresh Timeline  
- Setup workbook (first time)  
- Install edit triggers  

## MVP features

- Weekly timeline from min/max dates + critical dates  
- Month header row with merges  
- Contiguous project grouping + row collapse  
- Color precedence (same order as Python)  
- Critical week red override  
- Freeze panes (rows 1–3, columns A–E)  
- Validation tab  
- Debounced refresh on Start / Finish / Critical edits  

## Not in MVP

- Smartsheet API sync  
- Strict mode / JSON export  
- Python parity for every edge case  
- PDF snapshot export  

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)  
- [DATA_MODEL.md](./DATA_MODEL.md)  
- [DEPLOYMENT.md](./DEPLOYMENT.md)  
- [MIGRATION.md](./MIGRATION.md)  
