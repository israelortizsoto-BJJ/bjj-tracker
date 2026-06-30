# P1 Evidence — Session Freshness & Hydration Timing

| Field | Value |
|-------|-------|
| **Evidence ID** | MM-P1-001 |
| **Governing standard** | MM-REM-001 v2 §10 P1, §6 E6/E7 |
| **Priority** | P1 — Session freshness + Hydration timing |
| **Status** | In progress |
| **qaRunId** | `mm-p1-20260628-a` |
| **Dataset** | NC-004 pattern (fresh competition with coach breakdown) when live run executes |
| **Started** | 2026-06-28 |

---

## 1. Hypothesis under test

**H4 (MM-REM-001 §5):** Parent Compete opened before a parent session GET hydrates `coachMatchBreakdownArtifacts` into local artifact store → overlay absent despite successful coach publish.

**E7 PASS criterion:** Overlay absent on first Compete visit; appears after forced session refresh (E6).

**E6 PASS criterion:** Overlay visible when Compete opened only after session refresh completes.

---

## 2. Instrumentation (existing — no changes)

| Signal | Source | Meaning |
|--------|--------|---------|
| `[MB_BOUNDARY_PROBE]` B5 | Parent `coachSyncFetchSession` | Session GET received populated MB artifacts |
| `[COMP_FOCUS_RELOAD]` | `compete.tsx` | Compete tab focus; **no network** |
| `[COACH_OVERLAY_SYNC_TRACE] competition_card_parent_hydrate_complete` | `CompetitionCard.tsx` | Local artifact store read complete; `hydrateCount` |
| `[COACH_OVERLAY_PIPELINE_TRACE] artifact_cache_session_hydrate_begin` | `coachWeeklySyncCacheStore` | Session written to cache; artifact sets extracted |
| `[COACH_OVERLAY_SYNC_TRACE] parent_overlay_cache_hydrated_from_session` | Same | Artifact store write from session |
| `[THIS_WEEK WEEKLY TRACE] loadCoachShareData.networkOk` | `this-week/index.tsx` | Network session fetch |
| `[THIS_WEEK WEEKLY TRACE] loadCoachShareData.skipNetwork` | Same | Cache-only; **no** `coachSyncFetchSession` |
| `[MATCH_BREAKDOWN_AUTHORITY_TRACE] PARENT_PARSER` | `coachWeeklySyncApi.ts` | `fieldClassification`, `athleteEntryStatus` |
| `[API CALL] coachSyncFetchSession` | This Week / Summary paths | Session GET fired |

**Capture doctrine:** Coach → Xcode console; Parent → Metro; Worker → Wrangler tail (`dev-handoff.md`).

---

## 3. Live run protocol

Set the same `qaRunId` on **both** dev clients before starting:

```bash
export EXPO_PUBLIC_MB_QA_RUN_ID=mm-p1-20260628-a
```

Restart Metro / reload both apps after setting the variable.

### 3.1 Arm A — E7 (Compete before session refresh)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Coach | Save Match Breakdown on target competition (NC-004 or equivalent) |
| 2 | Coach | Wait 5s (publish fire-and-forget) |
| 3 | Parent | **Do not** open This Week; **do not** pull-to-refresh Summary |
| 4 | Parent | Open **Compete** tab directly |
| 5 | Parent | Observe target competition card — note overlay visible Y/N |
| 6 | Both | Capture logs; grep `qaRunId":"mm-p1-20260628-a"` |

**Expected if H4 holds:** `hydrateCount: 0`, no prior `loadCoachShareData.networkOk` or B5 in same session before `COMP_FOCUS_RELOAD`.

### 3.2 Arm B — E6 (Session refresh before Compete)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Coach | Save Match Breakdown (new note or same competition after Arm A) |
| 2 | Coach | Wait 5s |
| 3 | Parent | Open **This Week** (or Summary pull-to-refresh) — wait for load complete |
| 4 | Parent | Confirm log: `loadCoachShareData.networkOk` or B5 pass |
| 5 | Parent | Open **Compete** tab |
| 6 | Parent | Observe overlay visible Y/N |
| 7 | Both | Capture logs with same `qaRunId` suffix `-e6` if re-run: `mm-p1-20260628-a-e6` |

**Expected if H4 holds:** B5 pass + `parent_overlay_cache_hydrated_from_session` before `COMP_FOCUS_RELOAD`; `hydrateCount > 0`.

### 3.3 Log extraction commands

```bash
# Parent Metro — timing chain
rg 'mm-p1-20260628-a|COMP_FOCUS_RELOAD|competition_card_parent_hydrate|artifact_cache_session_hydrate|parent_overlay_cache_hydrated|loadCoachShareData\.(networkOk|skipNetwork)|MB_BOUNDARY_PROBE.*B5' parent-metro.log

# Coach — publish chain (context only for P1)
rg 'mm-p1-20260628-a|MB_BOUNDARY_PROBE.*B[13]|PUBLISH_TARGET' coach-xcode.log
```

---

## 4. Archived forensic pre-read (2026-06-24)

Source: `debug-logs/forensics-20260624-144039.md` (pre-dates `qaRunId` probes; trace-only).

### 4.1 Timeline (line numbers)

| Order | Line | Event | P1 relevance |
|-------|------|-------|--------------|
| 1 | 494 | `artifact_cache_session_hydrate_begin` — `artifactCount: 0` | Session path ran; **no MB artifacts in payload** |
| 2 | 1630–1702 | `COMP_FOCUS_RELOAD` — Compete focus | Compete opened; no network on this path |
| 3 | 2232–2234 | `artifact_store_get_miss` → `hydrateCount: 0` | Local store empty for active OAI |
| 4 | 2234 | `competition_card_parent_hydrate_complete` | Card hydrate finished with zero overlays |
| 5 | 2436+ | Later `coachSyncFetchSession` (This Week navigation) | Session refresh **after** Compete visit |
| 6 | 4707 | `PARENT_PARSER` — `athleteEntryStatus: "absent"`, `artifactCount: 0` | Worker GET had field present but no athlete artifacts |

### 4.2 Archived observations (not yet E6/E7 controlled)

1. **Compete does not network-fetch:** `COMP_FOCUS_RELOAD` at L1702 precedes card hydrate at L2234 with no intervening `coachSyncFetchSession` on the Compete path — consistent with MM-REM contract §2.2 B10.
2. **Empty artifact store at Compete render:** `artifact_store_get_miss` / `reason: "athlete_not_in_disk_map"` for `shared_ath_30f7839486385dece5c87217f05e797a` while disk held artifacts for **other** athlete IDs — local store not populated for active OAI.
3. **Session hydrate with zero artifacts:** L494 `artifact_cache_session_hydrate_begin` with `artifactSetCount: 0` — timing alone insufficient; payload also empty.
4. **No `parent_overlay_cache_hydrated_from_session` in entire capture** — artifact cache write path never accepted MB data in this log.

**Interpretation (bounded):** Archived log shows **Compete-first with empty local artifact store** — necessary but not sufficient to prove H4 alone, because worker payload also lacked MB artifacts (`athleteEntryStatus: absent`). Live P1 run must correlate **coach B3 pass** with **parent E7/E6 ordering**.

---

## 5. Live run results

### 5.1 Arm A — E7 (Compete before refresh)

| Field | Value |
|-------|-------|
| **Executed** | Pending live QA |
| **qaRunId** | `mm-p1-20260628-a` |
| **B5 before COMP_FOCUS** | — |
| **hydrateCount at first Compete** | — |
| **Overlay visible** | — |
| **Conclusion** | — |

### 5.2 Arm B — E6 (Refresh before Compete)

| Field | Value |
|-------|-------|
| **Executed** | Pending live QA |
| **qaRunId** | `mm-p1-20260628-a-e6` |
| **B5 before COMP_FOCUS** | — |
| **parent_overlay_cache_hydrated** | — |
| **hydrateCount at Compete** | — |
| **Overlay visible** | — |
| **Conclusion** | — |

### 5.3 E7 vs E6 comparison

| Criterion | E7 arm | E6 arm |
|-----------|--------|--------|
| Session GET before Compete focus | — | — |
| B5 pass | — | — |
| Overlay on first Compete visit | — | — |
| H4 supported? | — | — |

---

## 6. MM-REM-001 classification impact

Update §9 only after live arms complete:

| Variable | If E7 pass / E6 pass | If both fail |
|----------|----------------------|--------------|
| Session freshness | Unknown → **Likely Different** (timing causal) | Remains Unknown; escalate P2 Worker KV |
| Hydration timing | Unknown → **Likely Different** | Remains Unknown |

---

## 7. Next action

1. Run **Arm A (E7)** and **Arm B (E6)** on Current Dev with frozen `qaRunId`.
2. Paste log excerpts into §5.
3. Update MM-REM-001 §9 confidence for Session freshness / Hydration timing per §6.
