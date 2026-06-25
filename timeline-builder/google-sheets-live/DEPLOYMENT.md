# Deployment Instructions — Live Timeline Planner

## Prerequisites

- Google account with Google Sheets access  
- Permission to create Apps Script projects  
- (Optional) [clasp](https://github.com/google/clasp) for CLI deployment  

---

## Method A — Manual setup (fastest for pilot)

### 1. Create the spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) → **Blank spreadsheet**  
2. Name it e.g. `Live Timeline Planner`  

### 2. Add the script

1. **Extensions → Apps Script**  
2. Delete default `Code.gs` content  
3. Create one script file per module (or paste all into single `Code.gs` in this order):

   ```
   Constants.gs
   Utils.gs
   Config.gs
   ColorMatcher.gs
   Validation.gs
   TimelineEngine.gs
   SheetSetup.gs
   Main.gs          ← REQUIRED — refreshTimeline(), handleDataEdit, triggers
   ```

   **Without `Main.gs`, setup may succeed but live date edits will not refresh the Timeline.**

   After pasting, confirm in the Apps Script editor: **Run → select `refreshTimeline`** — it must appear in the function dropdown.

4. **Project Settings** (gear icon) → enable **Show "appsscript.json" manifest file**  
5. Set runtime to **V8** (in `appsscript.json`: `"runtimeVersion": "V8"`)  

### 3. First run

1. Select function **`setupLivePlanner`** in the toolbar dropdown  
2. Click **Run**  
3. **Review permissions** → choose account → Advanced → Allow  
4. Return to the spreadsheet — sample data, Config, Timeline, and Validation tabs appear  

### 4. Install edit triggers

If debounced refresh does not fire after editing dates:

1. Reload the spreadsheet  
2. Menu **Timeline Planner → Install edit triggers**  
3. Authorize again if prompted  

### 5. Verify MVP

1. On **Data**, change a **Finish Date**  
2. Wait ~2 seconds (or use **Refresh Timeline**)  
3. Confirm **Timeline** bars move  
4. Confirm **Validation** tab updates  

---

## Method B — clasp (team maintenance)

### 1. Install clasp

```bash
npm install -g @google/clasp
clasp login
```

### 2. Create bound script project

```bash
cd timeline-builder/google-sheets-live
clasp create --type sheets --title "Live Timeline Planner"
```

This creates `.clasp.json` linked to a new Sheet + Script project.

### 3. Push source

```bash
# clasp expects flat .gs files or configure rootDir
mkdir -p dist
cp src/*.gs dist/
cp appsscript.json dist/
clasp push
```

Or set in `.clasp.json`:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

Note: clasp requires `appsscript.json` alongside `.gs` files in `rootDir`. Copy manifest into `src/` if using `rootDir: "src"`.

### 4. Run setup remotely

In Apps Script editor → Run `setupLivePlanner`.

---

## Team rollout

| Step | Action |
|------|--------|
| 1 | Deploy one canonical spreadsheet from template |
| 2 | Share with PMs as **Editors** on Data tab workflow |
| 3 | Document: edit Data only; never edit Timeline for schedule changes |
| 4 | Optional: copy spreadsheet per program vs one shared planner |
| 5 | Train PMs on Validation tab when tasks disappear |

### Copy template for new projects

1. **File → Make a copy** of the setup spreadsheet  
2. New copy retains script — run **Refresh Timeline** once  
3. Clear Data rows; paste project tasks  

---

## Permissions summary

| Authorization | Why |
|---------------|-----|
| View/manage spreadsheet | Read Data, write Timeline |
| Run when edit occurs | Debounced refresh trigger |
| Show notifications | Toast messages |

---

## Troubleshooting deployment

| Issue | Fix |
|-------|-----|
| Menu missing | Reload sheet; re-open after first script save |
| `#REF!` or empty Timeline | Run **Setup workbook** or **Refresh Timeline** |
| Edit doesn't refresh | **Install edit triggers**; check edit is in cols C–E on Data |
| Authorization failed | Script editor → Run any function → re-authorize |
| Trigger quota exceeded | **Timeline Planner → Refresh Timeline** manually; remove duplicate triggers in Apps Script → Triggers |
| Script timeout | Reduce tasks/weeks; see ARCHITECTURE limits |

---

## Production checklist (MVP)

- [ ] `setupLivePlanner` run successfully  
- [ ] Sample timeline renders with colors and groups  
- [ ] Date edit triggers refresh within ~2s  
- [ ] Validation tab shows skipped row for blank test row  
- [ ] PM trained on Data vs Timeline tabs  
- [ ] Backup: **Refresh Timeline** menu if triggers fail  

---

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)  
- [MIGRATION.md](./MIGRATION.md)  
- [../OPERATIONAL_RUNBOOK.md](../OPERATIONAL_RUNBOOK.md) — Python batch workflow (still valid for snapshots)
