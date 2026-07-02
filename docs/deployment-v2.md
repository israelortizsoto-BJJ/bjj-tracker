# Deployment Architecture v1 — Phase 2

**DEPLOY-002** implements **certified deployment** for the Live Timeline Planner Apps Script project.

This phase adds clasp-based deployment, post-push verification, and a certification report. It does **not** change runtime behavior, triggers, Timeline logic, or validation rules.

---

## Operator command

The operator runs **one command** from the repository root:

```bash
python3 scripts/certify_deployment.py
```

That command executes the full certified deployment pipeline:

```
Validate Repository
        ↓
      Deploy
        ↓
Verify Deployment
        ↓
Produce Certification Report
```

No individual commands need to be remembered for normal operations.

---

## One-time setup

### 1. Install clasp (project-local)

```bash
npm install --prefix timeline-builder/google-sheets-live
```

### 2. Authenticate clasp

```bash
npm exec --prefix timeline-builder/google-sheets-live -- clasp login
```

### 3. Link Apps Script project

```bash
cp timeline-builder/google-sheets-live/clasp.json.example \
   timeline-builder/google-sheets-live/.clasp.json
```

Edit `.clasp.json` and set `scriptId` from the Apps Script project URL.

`.clasp.json` is gitignored — it is operator-local configuration, not canonical source.

---

## Certified deployment report

On completion, the operator sees:

```
Deployment Report

Repository Revision
4726a14

Manifest Version
1

Deployment Started

10:32:14

Deployment Finished

10:32:22

Apps Script Project

<project id>

Verification

Repository Files

9

Apps Script Files

9

Result

MATCH

Certification

PASS
```

Reports are also saved to:

```
timeline-builder/google-sheets-live/deployment-reports/deployment-YYYYMMDD-HHMMSS.txt
```

---

## Command reference

| Command | Purpose |
|---------|---------|
| `python3 scripts/certify_deployment.py` | **Primary operator command** — validate, deploy, verify, certify |
| `python3 scripts/validate_deployment.py` | Repository validation only (DEPLOY-001) |
| `python3 scripts/verify_deployment.py` | Remote verification only (no push) |

### Flags

| Flag | Behavior |
|------|----------|
| `--validate-only` | Stop after repository validation |
| `--verify-only` | Skip push; verify remote matches manifest |
| `--dry-run` | Validate and produce report without deploying |

---

## What each stage checks

### 1. Validate Repository

Uses `deployment.manifest.json` to confirm:

- All required files exist under `src/`
- Deployment order is complete
- No duplicate filenames
- `appsscript.json` is valid (V8 runtime)

Aborts deployment if **NOT READY**.

### 2. Deploy

Runs `clasp push --force` from `timeline-builder/google-sheets-live/` using:

- `.clasp.json` — project binding (`scriptId`, `rootDir: src`)
- Local `node_modules/@google/clasp` — pinned clasp version

### 3. Verify Deployment

Pulls remote Apps Script source to a temporary directory via `clasp pull` and compares filenames against the manifest.

| Check | Pass condition |
|-------|----------------|
| File count | Repository files == Apps Script files |
| File names | Exact set match |
| Result | `MATCH` |

Verification does **not** execute Apps Script functions or test Timeline behavior. Runtime certification is DEPLOY-005.

### 4. Certification

| Certification | Meaning |
|---------------|---------|
| **PASS** | Validation ready, deploy succeeded, verification MATCH |
| **FAIL** | Any stage failed |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ scripts/certify_deployment.py          ← operator entry point    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
 validate_repository    clasp push        verify_deployment
 (manifest + src/)      (deploy target)   (clasp pull → temp)
         │                   │                   │
         └───────────────────┴───────────────────┘
                             ▼
                  Deployment Report + artifact
```

Shared logic lives in `scripts/deployment_lib.py`.

---

## clasp configuration

Manifest clasp section (`deployment.manifest.json`):

```json
"clasp": {
  "configPath": ".clasp.json",
  "rootDir": "src",
  "exampleConfigPath": "clasp.json.example"
}
```

Operator `.clasp.json`:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "src",
  "scriptExtensions": [".gs", ".json"]
}
```

With `rootDir: "src"`, clasp pushes `src/*.gs` and `src/appsscript.json` directly — matching the DEPLOY-001 manifest.

---

## Phase map

| Phase | ID | Capability | Status |
|-------|-----|------------|--------|
| 1 | DEPLOY-001 | Repository validation + manifest | Complete |
| 2 | DEPLOY-002 | Certified clasp deployment | **This document** |
| 3 | DEPLOY-003 | Enhanced deployment verification | Planned |
| 4 | DEPLOY-004 | One-command deployment polish | Planned |
| 5 | DEPLOY-005 | Runtime certification | Planned |

---

## Constraints (unchanged)

This phase does **not**:

- Modify Timeline logic
- Modify triggers
- Modify validation rules
- Modify Apps Script runtime behavior
- Deploy MatMind or any code outside `timeline-builder/google-sheets-live/`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `clasp is not installed` | `npm install --prefix timeline-builder/google-sheets-live` |
| `clasp is not authenticated` | `npm exec --prefix timeline-builder/google-sheets-live -- clasp login` |
| `Missing .clasp.json` | Copy `clasp.json.example` → `.clasp.json`, set `scriptId` |
| `NOT READY` before deploy | Fix missing files; run `validate_deployment.py` |
| `MISMATCH` after deploy | Re-run certify; check for extra remote-only files in Apps Script editor |
| Certification `FAIL` | Read Errors section in report; check `deployment-reports/` artifact |

---

## Related documents

| Document | Purpose |
|----------|---------|
| [deployment-v1.md](./deployment-v1.md) | Phase 1 — repository validation |
| [timeline-builder/google-sheets-live/deployment.manifest.json](../timeline-builder/google-sheets-live/deployment.manifest.json) | Deployment contract |
| [timeline-builder/google-sheets-live/DEPLOYMENT.md](../timeline-builder/google-sheets-live/DEPLOYMENT.md) | Manual setup (pre-pipeline) |

---

## Success criterion

An operator can certify:

> **"This repository revision was deployed to Apps Script and the remote project matches the manifest."**

…with a single command and a persisted certification report — without opening the Apps Script editor.
