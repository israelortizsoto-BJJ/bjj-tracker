# Overlay Architecture v1

**Status:** Normative — anti-regression contract for authority, overlays, hydration, and publication.  
**Companion:** `docs/canonical-athlete-authority-spec.md` (OAI, identity planes, forbidden fallbacks).  
**Principle:** One canonical owner per fact class. Overlays decorate read models; they never mint parallel truth.

---

## 1. Canonical truth ownership

### 1.1 Shared athlete identity

| Item | Rule |
|------|------|
| **Global athlete id** | `sharedAthleteId` (OAI / `ParentAthlete.id`, convention `pa_*` / `shared_ath_*` after bind). |
| **Linkage** | Roster rows (`Kid.id`) link via `Kid.sharedAthleteId`; one primary row per shared id (`buildCanonicalSharedAthletePrimaryRowMap`). |
| **Scope key** | All cross-device artifacts, aggregates, and weekly maps are keyed by `sharedAthleteId`, not invite token alone. |
| **Forbidden** | Coach-owned athlete identity, invite-scoped parallel athletes, or route/`kidId`-derived global authority. |

### 1.2 Parent-owned athlete lifecycle data

**Owner:** Parent device / parent plane.

**Authoritative for:**

- `ParentAthlete` roster and persisted operating selection (`parentActiveAthleteId` / OAI).
- Raw training `Session[]` (local lineage).
- Competition entries, match results, timing, wins/losses, submissions (canonical competition facts).
- Bounded parent artifacts published to the invite session: `SyncedTrainingProofArtifact`, `SyncedCompetitionAggregateArtifact`.
- Weekly parent feedback overlay: `parentFeedback` (`viewedAt`, `acknowledgedAt`) on the athlete’s weekly doc.

**Coach may not:** create or overwrite canonical competitions, match outcomes, parent session counts, or parent athlete records.

### 1.3 Coach-owned weekly mission

**Owner:** Coach publish lane → `coach-sync-worker` session KV → parent read/cache.

**Authoritative for:**

- Per-athlete weekly mission payload (`SyncedWeeklyMessagePayload`): headline, body, taxonomy `systemKey`, family-facing resources, `coachOutcome`, published timestamps.
- `weeklyByAthleteId[sharedAthleteId]` scoping (via `resolveWeeklyDoc`).

**Parent may not:** mutate coach copy; parent only attaches **overlay** fields (`parentFeedback`) and consumes mission text read-only.

**Forbidden:** Weekly cache or publish payload choosing OAI or substituting athlete scope.

---

## 2. Overlay systems

Overlays are **bounded, scoped projections** merged at read time (signals, Summary, coach surfaces). They do not replace canonical stores.

| Overlay | Canonical owner | Overlay scope | Consumer |
|---------|-----------------|---------------|----------|
| **Parent acknowledgement** | Parent (`parentFeedback` on weekly doc) | `viewedAt` / `acknowledgedAt` on coach-published weekly | Parent This Week (write); coach roster / kid detail (read via session hydrate) |
| **Training proof** | Parent sessions → `SyncedTrainingProofArtifact` | Coach Summary frequency, dominance, top systems/techniques when proof visible | `overlayTrainingProofSignals` (coach device, OAI-scoped) |
| **Competition aggregate** | Parent competitions → `SyncedCompetitionAggregateArtifact` | Bounded win/submission/rate metrics when no full local match lineage on coach | `overlayCompetitionAggregateSignals` (coach device; skipped if local canonical matches present) |
| **Coach match breakdown** | Parent match facts | Coach-local `coachNote`, match-level review fields, media attachments on competition detail | Coach Compete review UI; does not rewrite parent results |
| **Coach voice-note** | Coach (ephemeral capture) | Audio → transcription → `coachNote` overlay on match breakdown | Same as match breakdown; never published as parent canonical match data |

**Overlay precedence (locked):**

- Training proof on coach Summary: `parent proof > empty` — coach-local training sessions **never** override parent proof.
- Competition aggregate: apply only when coach lacks full local match lineage; stale local coach rows must not suppress valid remote aggregates incorrectly (hydrate + visibility gates).

---

## 3. Hydration rules

### 3.1 Allowed

- Overlays **may rehydrate** from writer-session GETs (`reconcileCoachTrainingProofFromWriterSessions`, `reconcileCoachCompetitionAggregatesFromWriterSessions`, weekly session snapshot, `pickPublishedWeeklyParentFeedbackForSharedAthlete`).
- Overlays **may invalidate caches** and bump recompute (`coachSyncHydrationStore` → `useSignals` / `useAthleteData` reload).
- Hydration is **overwrite-only** into coach overlay stores (`coachTrainingProofStore`, `coachCompetitionAggregateStore`, weekly cache) keyed by `sharedAthleteId`.
- Newest-wins selection across writer sessions when multiple candidates exist.

### 3.2 Forbidden

- Overlays **may NOT create alternate owners** (no second athlete id, no invite-only truth, no coach-minted OAI).
- Hydration **may NOT** change OAI, pick athlete from weekly keys alone, or attach another athlete’s artifact to the active scope.
- Hydration **may NOT** write canonical parent competition rows or parent sessions from coach hydrate paths.
- Overlay merge **may NOT** fabricate counts or sessions when proof/aggregate is absent (empty is valid).

---

## 4. Publication rules

Every feature that crosses parent/coach or local/remote **must declare** the five fields below in design or PR description.

| Field | Question to answer |
|-------|-------------------|
| **Canonical owner** | Which plane owns the source fact if this feature vanished? |
| **Overlay scope** | What fields are derived/read-model only? |
| **Hydration trigger** | What event refetches or rewrites overlay stores? (session GET, publish ack, pull-to-refresh, `bumpCoachSyncHydrationVersion`, local parent save → schedule publish) |
| **Reconcile direction** | On conflict, which side wins? (e.g. parent aggregate → coach store; coach weekly → parent cache; parent feedback → merged onto weekly doc) |
| **Publication direction** | Who writes upstream? (e.g. parent → `PUT …/training-proof`; coach → weekly publish; parent → aggregate PUT) |

### 4.1 Reference flows (v1)

```text
Parent sessions → buildTrainingProofArtifact → publishParentTrainingProof → worker KV
  → coach hydrate → overlayTrainingProofSignals → Coach Summary

Parent competitions → buildCompetitionAggregateArtifact → publishParentCompetitionAggregate → worker KV
  → coach hydrate → overlayCompetitionAggregateSignals → Coach Summary

Coach weekly publish → worker KV → parent fetch/cache → resolveWeeklyDoc (parent read)

Parent markWeeklyAcknowledged → parentFeedback overlay → (cache / future worker merge) → coach hydrate read

Coach match review / voice-note → local coachNote overlay → competition detail read only
```

---

## 5. Safety rule (non-negotiable)

No feature may introduce:

| Violation | Why it regresses |
|-----------|------------------|
| **Duplicate athlete ownership** | Two selectors (OAI + kid/global) diverge; Summary and coach bleed athletes. |
| **Alternate canonical entities** | Second competition or session truth on coach device collides with parent publish. |
| **Invite-scoped parallel truth** | Token becomes athlete identity; multi-invite/multi-athlete breaks. |
| **Coach-owned athlete identity** | Coach roster or route mints `pa_*` / operating scope without parent plane. |

**Regression checks before merge:**

- Single OAI per operating context; overlays keyed by same `sharedAthleteId`.
- Coach Summary with missing proof shows empty metrics, not invented sessions.
- Coach cannot mutate parent-owned competition results or aggregate source data.
- Hydration bump recomputes overlays without navigation remount hacks.

---

## 6. Feature declaration template

Copy into PR / design notes:

```text
Canonical owner:
Overlay scope:
Hydration trigger:
Reconcile direction:
Publication direction:
Safety review: (confirm none of §5 violations)
```

---

**Version:** 1.0 — formalizes stabilization-era authority + overlay split. Implementation may lag; new work converges **toward** this doc, not away from it.
