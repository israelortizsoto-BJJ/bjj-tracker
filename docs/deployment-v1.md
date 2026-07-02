# Deployment Architecture v1 — Phase 1

**DEPLOY-001** establishes the repository as the canonical source of truth for the Live Timeline Planner Apps Script project.

This document covers deployment **infrastructure only**. It does not change runtime behavior, triggers, or Timeline logic.

---

## Deployment philosophy

| Principle | Meaning |
|-----------|---------|
| **Git is canonical** | `timeline-builder/google-sheets-live/` is the authoritative source. Apps Script, clasp, and spreadsheets are deploy targets. |
| **Structure before push** | An operator must be able to certify repository completeness before any Google API call. |
| **Small certifiable floors** | Each DEPLOY phase adds one verifiable capability. Phase 1 answers: *Is the repo structurally ready?* |
| **No silent drift** | Manual copy/paste and editor-side edits created drift. The pipeline exists to prevent recurrence. |

---

## Canonical source

```
timeline-builder/google-sheets-live/
├── deployment.manifest.json   ← machine-readable deployment contract
├── appsscript.json            ← reference copy (root)
└── src/
    ├── appsscript.json        ← deploy-time manifest (clasp rootDir)
    ├── Constants.gs
    ├── Utils.gs
    ├── Config.gs
    ├── ColorMatcher.gs
    ├── Validation.gs
    ├── TimelineEngine.gs
    ├── SheetSetup.gs
    └── Main.gs
```

**Deployable source** lives under `src/`. The manifest at `deployment.manifest.json` defines required files, deployment order, and verification targets.

Historical operator docs (`DEPLOYMENT.md`, `ARCHITECTURE.md`) remain valid for runtime context. This document governs the **certification pipeline**.

---

## Deployment manifest

`deployment.manifest.json` is the contract between repository and deploy tooling.

It defines:

- **requiredFiles** — every file that must exist before deployment
- **deploymentOrder** — load order for Apps Script modules (dependencies before consumers)
- **manifestFiles** — Apps Script project manifest (`appsscript.json`)
- **verification** — structural checks (e.g. `runtimeVersion: V8`)

Future phases (clasp push, post-deploy verification) will read this manifest rather than hard-coding file lists.

---

## Deployment lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Edit source    │────►│  Validate repo   │────►│  Deploy target  │
│  (git commit)   │     │  (Phase 1 ✓)     │     │  (Phase 2+)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        READY / NOT READY
```

### Phase map

| Phase | ID | Capability | Status |
|-------|-----|------------|--------|
| 1 | DEPLOY-001 | Repository validation + manifest | Complete |
| 2 | DEPLOY-002 | Certified clasp deployment | See [deployment-v2.md](./deployment-v2.md) |
| 3 | DEPLOY-003 | Enhanced deployment verification | Planned |
| 4 | DEPLOY-004 | One-command deployment polish | Planned |
| 5 | DEPLOY-005 | Runtime certification | Planned |

Phase 1 does **not** deploy, push, or invoke Google APIs. Phase 2 adds certified deployment — see [deployment-v2.md](./deployment-v2.md).

---

## Operator workflow

### Before any deployment attempt

From the repository root:

```bash
python scripts/validate_deployment.py
```

**Ready output:**

```
Deployment Validation

✓ Constants.gs
✓ Utils.gs
...
✓ appsscript.json

Status:
READY FOR DEPLOYMENT
```

**Not ready output:**

```
Deployment Validation

✗ Missing Main.gs

Status:
NOT READY
```

### What the validator checks

1. Manifest exists and parses
2. Every `requiredFiles` entry exists under `src/`
3. `deploymentOrder` matches the script file set
4. No duplicate filenames under `src/`
5. `src/appsscript.json` exists with required keys and `runtimeVersion: V8`

### What the validator does not check

- Apps Script project state in Google Cloud
- Spreadsheet bindings or triggers
- Runtime behavior (Timeline refresh, edit handlers)
- clasp credentials or `.clasp.json`

Those belong to later phases.

---

## Deployment order rationale

Apps Script loads all `.gs` files into a shared namespace. Order matters for human paste workflows and for mental model consistency:

1. **Constants.gs** — sheet names, column layout
2. **Utils.gs** — date/week helpers (no module deps)
3. **Config.gs** — Config tab I/O
4. **ColorMatcher.gs** — color rules
5. **Validation.gs** — row validation
6. **TimelineEngine.gs** — grid build (uses Config, ColorMatcher, Validation)
7. **SheetSetup.gs** — initial workbook setup
8. **Main.gs** — menu, `refreshTimeline()`, triggers (entry point)

`Main.gs` must be present. Without it, setup may succeed but live date edits will not refresh the Timeline.

---

## Future clasp integration (DEPLOY-002)

Implemented in [deployment-v2.md](./deployment-v2.md). Operator command:

```bash
python3 scripts/certify_deployment.py
```

---

## Related documents

| Document | Purpose |
|----------|---------|
| [timeline-builder/google-sheets-live/DEPLOYMENT.md](../timeline-builder/google-sheets-live/DEPLOYMENT.md) | Manual setup and clasp notes (pre-pipeline) |
| [timeline-builder/google-sheets-live/ARCHITECTURE.md](../timeline-builder/google-sheets-live/ARCHITECTURE.md) | Module map and refresh pipeline |
| [timeline-builder/google-sheets-live/deployment.manifest.json](../timeline-builder/google-sheets-live/deployment.manifest.json) | Machine-readable deployment contract |

---

## Success criterion

An operator can answer:

> **"Is this repository structurally complete and ready to deploy?"**

…without opening Apps Script.

When validation reports `READY FOR DEPLOYMENT`, the repository floor is certified. Runtime certification (DEPLOY-005) is a separate concern.
