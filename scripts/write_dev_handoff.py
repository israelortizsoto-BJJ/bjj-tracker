#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime
import shutil
import subprocess

REPO_ROOT = Path("/Users/ods/Repos/bjj-tracker")
TARGET_DOC = REPO_ROOT / "docs" / "dev-handoff.md"

TODAY = datetime.now().strftime("%Y-%m-%d %H:%M")

def run(cmd):
    return subprocess.check_output(cmd, cwd=REPO_ROOT, text=True).strip()

git_status = run(["git", "status", "-sb"])
latest_commit = run(["git", "log", "--oneline", "--decorate", "-5"])

changed_files = run([
"git",
"diff",
"--name-only",
"HEAD~2..HEAD"
])

handoff = f"""

# DEV HANDOFF — {TODAY}

## Runtime Focus

Competition runtime stabilization, replay governance, topology vs aggregate convergence, and architecture governance formalization.

---

# Major Runtime Discoveries

## Summary vs Compete Architectural Split

Confirmed:

* Summary renders through:

  * `computeSignals`
  * aggregate overlay
  * `overlayCompetitionAggregateSignals`
* Compete renders through:

  * topology projection
  * `projectCompetitionCompeteView`
  * `CompetitionCard`

Meaning:
Summary and Compete do NOT render from the same final convergence substrate.

---

## Replay Asymmetry Confirmed

Observed:

* topology replay uses strict `>`
* aggregate replay uses `>=`

This creates deterministic divergence windows under equal timestamp conditions.

---

## Projection Invalidation Root Cause

Grounded finding:
`overlayCompetitionAggregateSignals`
peeked topology state for `competitionCount`,
BUT:
`useSignals`
did NOT subscribe to topology invalidation (`competitionVersion`).

This caused:

* Compete topology updates appearing before Summary convergence
* stale Summary counts
* delayed overlay recompute

---

# Runtime Governance Work Completed

Created architecture governance suite:

* `docs/architecture/hydration-orchestration-v1.md`
* `docs/architecture/runtime-dependency-maps-v1.md`
* `docs/architecture/recovery-systems-v1.md`
* `docs/architecture/invalidation-cache-systems-v1.md`
* `docs/architecture/sequence-diagrams-v1.md`
* `docs/architecture/competition/competition-runtime-governance-v1.md`
* `docs/architecture/competition/competition-runtime-invariants-v1.md`
* `docs/architecture/competition/competition-stabilization-roadmap-v1.md`

Governance now includes:

* runtime planes P1–P6
* ownership doctrine
* replay doctrine
* invalidation doctrine
* stabilization sequencing
* recovery governance
* AI mutation safety zones
* bounded Codex/Cursor governance

---

# Runtime Stabilization Patch Applied

Commit:
`eddc0e7`
`Stabilize coach Summary topology overlay recompute timing`

Patch:

* Added `competitionVersion` subscription inside `useSignals`
* Added coach-gated topology invalidation recompute dependency
* Preserved:

  * replay semantics
  * hydration ordering
  * store ownership
  * invalidation ownership
  * persistence boundaries

Scope:
Read-only projection invalidation alignment only.

---

# QA Results

## PASS

* Summary no longer exhibited obvious topology recompute lag
* Athlete fast switching stable
* Summary/Compete counts stable during navigation
* No replay bleed observed
* No duplicate competitions observed
* No hydration flicker observed

## REMAINING ISSUE

Coach aggregate remains stale:

* Summary shows `30-12`
* Historical topology inspection indicates `30-13`

Important:
This is NOT the same issue as projection invalidation timing.

Likely remaining runtime class:

* aggregate publication staleness
* aggregate replay acceptance
* parent aggregate rebuild omission
* equal timestamp aggregate replay behavior

Projection convergence appears improved.
Aggregate correctness remains unresolved.

---

# Parent App State

Important runtime event:
Parent app was deleted/reinstalled during QA.

Effects:

* P1 canonical local stores lost on parent device
* Parent app relinked Luca only
* Mikey blocked by ghost athlete detection
* Coach app retained:

  * topology artifacts
  * aggregate artifacts
  * overlays
  * shared competition shells

Major discovery:
Coach mirrors already function as a bounded survivability substrate.

Recovery orchestration does NOT yet exist.

---

# Latest Git Status

```text
{git_status}
```

---

# Latest Commits

```text
{latest_commit}
```

---

# Recently Changed Files

```text
{changed_files}
```

---

# Known Runtime Risks

* aggregate replay asymmetry
* equal timestamp divergence
* stale aggregate overlays
* hydration ordering ambiguity
* refresh-dependent convergence
* incomplete recovery orchestration
* parent deletion non-recoverability
* aggregate publication correctness

---

# Recommended Next Steps

## Phase 1 — Replay Governance Investigation

Focus:
Why aggregate artifacts remain stale while topology/history appears newer.

Priority targets:

1. aggregate artifact publication path
2. aggregate builder completeness
3. aggregate replay acceptance behavior
4. equal timestamp handling
5. parent mutation → aggregate rebuild chain
6. aggregate overwrite ordering
7. reconcile timing

DO NOT:

* rewrite hydration
* widen ownership
* add new stores
* introduce speculative recovery systems
* mutate replay semantics broadly

Continue operating inside:

* runtime governance doctrine
* invariant doctrine
* stabilization roadmap sequencing

---

# Operational Notes

Notion operationalization started:

* runtime cognition layer
* proof-of-work engineering case study
* architecture governance capture
* future portfolio narrative
* AI-assisted engineering governance

Current strategic transition:
Reactive debugging → governed distributed runtime engineering.
"""

def main():
    TARGET_DOC.parent.mkdir(parents=True, exist_ok=True)

    if TARGET_DOC.exists():
        backup = TARGET_DOC.with_suffix(".backup.md")
        shutil.copy2(TARGET_DOC, backup)
        print(f"Backup created: {backup}")

    existing = ""
    if TARGET_DOC.exists():
        existing = TARGET_DOC.read_text()

    TARGET_DOC.write_text(existing + "\n" + handoff)

    print(f"Updated handoff: {TARGET_DOC}")


if __name__ == "__main__":
    main()
