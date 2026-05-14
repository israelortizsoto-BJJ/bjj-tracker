# Canonical Athlete Authority Specification (P0.5)

**Product:** MatMind (BJJ Tracker)  
**Status:** Normative architecture — engineering, QA, sync, routing, and future proofing.  
**Principle:** Optimize for **long-term platform stability**, not convenience, minimal diffs, or legacy assumptions.

This document defines how **athlete authority** is supposed to work. Implementation may lag; when it diverges, implementation must converge **toward** this spec, not the reverse.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Operating Athlete Id (OAI)** | The single app-wide answer to “which athlete is selected for operating context?” |
| **sharedAthleteId** | Stable parent-plane athlete id (`ParentAthlete.id`, typically `pa_*`) attached to roster rows, sessions, competitions, and weekly payloads for linkage. |
| **Kid.id** | Coach-roster (and mirrored parent) **row** identifier for a child record; not interchangeable with OAI for global authority. |
| **Derived mirror** | In-memory or persisted UX hints computed from OAI + roster; must not contradict OAI once hydrated. |

---

## 1. Canonical athlete authority

### 1.1 What is the ONE operating athlete authority?

The **Operating Athlete Id (OAI)** is:

- **Type:** `ParentAthlete.id` — a stable string owned by the parent athletes plane (convention `pa_*`).
- **Semantic:** The athlete profile the product treats as “active” for cross-tab operating context (Summary, signals, default training scope, weekly alignment, competition scoping where tied to athlete).

**Canonical persistence (selection):**

- Primary persisted key: **`StorageKeys.parentActiveAthleteId`** (`mm:v1:parentActiveAthleteId`), read/written via `athleteStore` (`getActiveAthleteId` / `setActiveAthleteId`).
- Athlete roster payload: **`StorageKeys.parentAthletes`** (`mm:v1:parentAthletes`) — authoritative list of `ParentAthlete` records; OAI must always refer to an id present in this list (or the app is in an explicit repair/onboarding path).

**Canonical cross-tab selection:**

- All tabs that mean “the app’s selected athlete” **consume OAI** (directly or via `useActiveAthlete` / a thin selector that reads the same store).
- **Cross-tab** means: switching athlete in one surface must eventually converge every consumer on the same OAI unless a surface is explicitly **route-scoped only** (see §5).

**Canonical Summary selection:**

- Summary’s athlete scope is **OAI**, not route params, not weekly cache keys in isolation, and not coach roster row id alone.
- Linked roster kid for weekly/competition lineage is **derived** from `(kidsById, OAI)` via `sharedAthleteId` match (see `resolveIdentity`, `linkedKidIdForParentAthlete`).

**Canonical sync identity:**

- Remote weekly and competition payloads are keyed by **sharedAthleteId == OAI** for parent-owned athlete linkage.
- Coach device “operating” context still resolves to the same OAI type for linked kids; coach roster row (`Kid.id`) is for **coach-local** writes and navigation, not a second global athlete authority.

### 1.2 What is NOT canonical anymore (normative)

The following must **not** be treated as independent sources of truth for global athlete authority:

| Non-canonical | Rationale |
|---------------|-----------|
| **`activeKidStore` (in-memory)** | Ephemeral mirror for UI and lineage joins; may track `Kid.id` for scoped flows but **must not** define OAI. |
| **Route params (`kidId`, etc.)** | Scope a **screen** or **stack**; they do not own global selection (§5). |
| **`StorageKeys.lastAthleteId`** (`mm:v1:lastAthleteId`) | Parent This Week **hint** (“last roster kid”) for UX continuity; **not** OAI. May participate only in **controlled** fallbacks (§4). |
| **Weekly sync cache** (`coachWeeklySyncCacheByToken`) | Read-through cache of coach content; **must not** pick OAI. |
| **Family competition selected kid** (`familyCompetitionSelectedKidId`) | Lane-local preference; **must not** override OAI. |
| **First sorted athlete / first linked athlete** | Bootstrap-only fallback when persisted OAI is invalid or missing (§4); not a standing authority. |
| **Signal cache / previous `useSignals` output** | Prevents empty flashes; **must not** redefine athlete scope (§7). |

---

## 2. Identity planes

Each plane has a **purpose**, **owner**, **reads/writes**, **authority vs derived**, and **sync**.

### 2.1 Parent athlete plane

| | |
|--|--|
| **Purpose** | Define household athletes (`ParentAthlete`) and persisted OAI. |
| **Ownership** | Parent app install; parent UX and onboarding. |
| **Allowed writes** | Create/update/delete `ParentAthlete`; `setActiveAthleteId` (with clear rules: no silent clear — see `setActiveAthleteId` options). |
| **Allowed reads** | Any feature needing “who are our athletes” or OAI. |
| **Authority** | **Authoritative** for OAI and athlete metadata. |
| **Sync** | Local persistence today; future account sync must treat this plane as **parent-owned** replicated data with conflict rules (out of scope here). |

### 2.2 Coach roster plane

| | |
|--|--|
| **Purpose** | Rows (`Kid`) for coach workflows: weekly, standing guidance, coach navigation. |
| **Ownership** | Coach share + parent mirror in `coachKidsById`; coach writer sessions on coach device. |
| **Allowed writes** | Coach-side fields per RBAC; parent accepts invites and links `sharedAthleteId` on rows. |
| **Allowed reads** | Any flow needing roster lookup, archive state, `Kid.id` for coach routes. |
| **Authority** | **Authoritative for roster row identity** (`Kid.id`) and coach-local drafts; **not** for OAI. |
| **Sync** | Coach sync / weekly publish paths; linkage fields carry `sharedAthleteId`. |

### 2.3 Route plane

| | |
|--|--|
| **Purpose** | Deep links, stack history, modals, per-kid coach screens (`/coach/kid/[kidId]/…`), This Week kid subroutes. |
| **Ownership** | Expo Router / navigation layer. |
| **Allowed writes** | Navigation only; **no direct** `setActiveAthleteId` except through an explicit **“make this my athlete”** affordance that calls the canonical selector. |
| **Allowed reads** | Params for loading resources tied to a row or draft. |
| **Authority** | **Route-scoped context only**; see §5. |
| **Sync** | N/A (URLs may carry ids for deep links; server does not “sync routes”). |

### 2.4 Training lineage plane

| | |
|--|--|
| **Purpose** | Bind training `Session` rows to athlete identity over time (`sharedAthleteId`, and optionally `kidId` for lineage). |
| **Ownership** | Parent device primary; coach local sessions are a separate bucket today. |
| **Allowed writes** | Session create/edit with explicit lineage fields; relink flows must rewrite or orphan per policy. |
| **Allowed reads** | Summary, training tab, signals — via `useAthleteData` lineage filter. |
| **Authority** | **Authoritative locally** for raw sessions on each device; **replicated proof** (Recommendation A) becomes the cross-device read model for aggregates. |
| **Sync** | Today: parent sessions largely local; future **Training Proof** lane (§6). |

### 2.5 Competition plane

| | |
|--|--|
| **Purpose** | Competitions and matches keyed by `sharedAthleteId` (+ kid row where applicable). |
| **Ownership** | Shared parent/coach with remote reconciliation (`kidCompetitionStore` patterns). |
| **Allowed writes** | Create/update with explicit athlete linkage; repair migrations for legacy missing `sharedAthleteId`. |
| **Allowed reads** | Summary, Compete tab, coach views — scoped by OAI + linkage. |
| **Authority** | **Authoritative** for competition facts once written; selection of **which kid’s compete lane** may use lane-local prefs without changing OAI. |
| **Sync** | Remote + local merge; stale handling per §7. |

### 2.6 Weekly sync plane

| | |
|--|--|
| **Purpose** | Coach-published weekly message and taxonomy alignment per athlete. |
| **Ownership** | Server + coach publish; parent fetch/cache. |
| **Allowed writes** | Coach publish; parent read cache update; dev diagnostics. |
| **Allowed reads** | Summary alignment, This Week displays. |
| **Authority** | **Authoritative for weekly coach content**, not for OAI. |
| **Sync** | HTTP fetch + `coachWeeklySyncCacheByToken`; invalidation must not swap athlete. |

### 2.7 Athlete intelligence plane

| | |
|--|--|
| **Purpose** | Derived **signals**, **Summary view models**, progression/alignment **computations** from sessions + competitions + weekly + (future) training proof. |
| **Ownership** | Pure/derived layer (`computeSignals`, `buildSummaryViewModel`, etc.). |
| **Allowed writes** | None to authority stores as a side effect of computation (except explicit opt-in telemetry). |
| **Allowed reads** | All lower planes via injected inputs only. |
| **Authority** | **Derived only**; if inputs are empty, output reflects “no proof” — no invention of sessions. |
| **Sync** | N/A; consumes replicated and local inputs. |

**Definition:** *Athlete intelligence* is the **first-class derived system** that answers “what should we say about this athlete’s journey?” It must never silently change **who** the athlete is; it only interprets OAI-scoped inputs.

---

## 3. Directionality rules (critical)

Normative **mutation** rules:

| Actor | May mutate OAI? | Notes |
|-------|------------------|-------|
| **Athlete selector UI** | **Yes** | Calls `setActiveAthleteId` with explicit user choice. |
| **Onboarding / add athlete** | **Yes** | After create, set OAI to new or chosen id. |
| **`useActiveAthlete` hydration** | **Repair only** | May set OAI when stored id invalid **or** coach bootstrap (first linked) per §4; must not oscillate. |
| **Route params** | **No** | May not call `setActiveAthleteId` implicitly on focus/mount. |
| **`activeKidStore` consumers** | **No** for OAI | May set in-memory kid id only as **mirror** of `(OAI → kid)` or controlled This Week derivation — never reverse the arrow to “kid picks athlete”. |
| **`useDerivedActiveAthleteKidId`** | **Indirect** | May set `activeKidId` for This Week continuity; must **not** persist a competing “global athlete” or override OAI. |
| **Weekly sync fetch / cache write** | **No** | Never changes OAI. |
| **Competition lane picker** | **No** for OAI | Updates lane-local keys only. |
| **`useAthleteData` / `useSignals`** | **No** | Load and compute for given OAI; no feedback into selection. |
| **Cache restore (weekly)** | **No** for OAI | Hydrate coach content for current OAI only. |
| **Relink / invite flows** | **Conditional** | May update roster `sharedAthleteId` and trigger **explicit** OAI repair if current OAI impossible — user messaging required if ambiguous. |

**Golden arrow:**

```text
parentAthletes + parentActiveAthleteId (OAI)
        ↓
   linked roster kid (derived via sharedAthleteId)
        ↓
   sessions / competitions / weekly (scoped reads)
        ↓
   athlete intelligence (signals, Summary VM)
```

**Forbidden loop:** `kidId` route → `setActiveKidId` → inferred OAI change. Not allowed without explicit product decision and user consent.

---

## 4. Fallback policy

### 4.1 Allowed fallbacks

| Situation | Fallback | Condition |
|-----------|----------|-----------|
| Missing invalid OAI | **First eligible linked athlete** (coach) or **first valid athlete** (parent) | Only when persisted id empty or not in roster; **persist** chosen id immediately to avoid re-randomizing. |
| Transient empty read | **Last-known OAI in-memory** | Single-generation guard against storage race; not a second persisted source. |
| This Week kid resolution | **Explicit active kid** → **persisted lastAthleteId** → **first eligible kid** | Documented in `useDerivedActiveAthleteKidId`; must stay subordinate to OAI for parent Summary. |
| Invite relink | **Repair linkage** on roster row | May clear stale `sharedAthleteId` or set new; competitions may mark mismatch — user-visible repair if data orphaned. |
| Stale weekly cache | **Show stale with banner / refresh** | Prefer stale coach text over wrong athlete association; never attach cache to wrong OAI. |
| No athlete | **Onboarding / empty states** | Explicit UX; intelligence returns “no proof” states, not fabricated counts. |

### 4.2 Forbidden fallbacks

- Picking OAI from **weekly payload keys** alone.
- Picking OAI from **competition lane** selection.
- Picking OAI from **route param** on navigation unless user confirms “switch athlete”.
- **Reusing signals** from a **previous** OAI as if current (see §7 — stale signal reuse).
- **Clearing OAI** without `allowClear` except explicit account reset / user logout policy.

### 4.3 UX-safe defaults

- Prefer **blocking** or **skeleton** over wrong-athlete content.
- Coach Summary “no sessions” is **valid** when training proof is absent (Recommendation A gap) — not a fallback to another athlete.

### 4.4 Multi-athlete rules

- **One OAI** per device session at a time for operating context.
- Switching athletes **invalidates** in-memory mirrors (`activeKidStore` sync from new OAI).
- **Per-athlete** persisted data (focus, session plans) keys by OAI — no cross-athlete reads.

### 4.5 When explicit user choice is required

- Two or more **valid** athletes and stored OAI **invalid** after delete.
- Relink changes **which** roster row maps to an OAI and user could mean different household member.
- Deep link to a **different** `kidId` than current mirror — show context or “View as coach” without silently retargeting parent OAI.

---

## 5. Route ownership

### 5.1 Route-scoped state

- Params (`kidId`, `entryId`, …), loading spinners, draft form state, scroll positions.
- Coach kid detail stacks scoped to **Kid.id**.

### 5.2 Globally authoritative state

- OAI (`parentActiveAthleteId`), `parentAthletes`, device role, account-level settings.

### 5.3 Temporary UI state

- Modals, toasts, ephemeral filters, dev traces.

### 5.4 Deep-link behavior

- Deep link **opens** a route and loads **row-scoped** data.
- Does **not** by default change OAI; may offer **“Switch to this athlete”** that calls canonical setter.

### 5.5 Hydration precedence

1. Restore **device role**.  
2. Restore **parentAthletes** list.  
3. Restore **OAI** from `parentActiveAthleteId` if valid.  
4. Apply **bootstrap fallback** if invalid (§4) and persist.  
5. Derive **linkedKidId** / weekly identity (`resolveIdentity`).  
6. Hydrate **lane-local** prefs (competition kid, last This Week kid).  
7. Load **caches** (weekly) **for** current OAI, never before OAI fixed.

### 5.6 Can routes EVER override global athlete authority?

**No**, except an explicit, user-visible **commit** action that calls the same code path as the global athlete picker. Navigation alone is insufficient.

---

## 6. Training proof architecture (Recommendation A)

Normative target (aligned with `docs/dev-handoff.md`):

### 6.1 Parent-owned training

- Full `Session` rows, journals, notes, media, detailed logs stay **parent-authoritative** and **privacy-rich**.
- Parent device is the **writer** for raw training.

### 6.2 Replicated proof

- A dedicated **Training Proof** artifact per `sharedAthleteId` (OAI): rolling counts, proof windows, dominance, top systems, timestamps, alignment-relevant aggregates.
- **Not** raw journals, private notes, or media blobs.

### 6.3 Coach-visible proof

- Coach Summary and coach intelligence consume **Training Proof** + weekly + competitions — **not** parent raw sessions by default.

### 6.4 Private local-only fields

- Anything identifiable or narrative stays on parent unless explicitly opted in.

### 6.5 Future worker payload shape (illustrative)

- Bounded JSON: `{ sharedAthleteId, proofVersion, windowStart, windowEnd, sessionCount, topSystems[], signalDigest, updatedAt }` — exact fields TBD; must remain **versioned** and **append-only** friendly.

### 6.6 Consumption matrix

| Consumer | Parent raw sessions | Training Proof | Weekly | Competitions |
|----------|---------------------|------------------|--------|----------------|
| **Parent Summary** | Yes (local) | Optional when exists | Yes | Yes |
| **Coach Summary** | No (default) | Yes (when implemented) | Yes | Yes |
| **Coach kid screens** | No | Via proof + weekly as designed | Yes | Partial per feature |

---

## 7. Cache + hydration rules

### 7.1 What may hydrate from disk

- `parentAthletes`, `parentActiveAthleteId` (OAI), roster blobs, sessions, competitions, weekly cache, lane prefs.

### 7.2 What may restore authority

- **Only** `parentActiveAthleteId` (and repair rules in §4) restores OAI.  
- `lastAthleteId` restores **This Week kid hint**, not OAI.

### 7.3 Stale cache behavior

- Weekly cache keyed by **invite token** (or equivalent) is **content cache**, not identity.  
- On token/athlete mismatch: **drop** cache slice or show explicit refresh — no merge across athletes.

### 7.4 Reload / reconnect

- Reload: full hydration order §5.5.  
- Reconnect: refresh remote **content** for fixed OAI; **do not** change OAI on network flap.

### 7.5 Eliminating known failure modes

| Failure | Rule |
|---------|------|
| **Authority flapping** | Single mutation path to OAI; debounce storage listeners; avoid mount/unmount races clearing id. |
| **Cache overwrites** | Never write weekly cache → back into `parentActiveAthleteId`. |
| **Stale signal reuse** | When OAI empty or changed, signals must not return **previous athlete’s** computed output as current (parent: prefer null/loading; dev warnings only). |

---

## 8. Migration strategy (sequencing only)

1. **Stabilize OAI** — single persistence, single subscription, explicit repair fallbacks (no silent clear).  
2. **Freeze directionality** — audit all `setActiveAthleteId` / `setActiveKidId` call sites against §3.  
3. **Make mirrors derived** — `activeKidStore` and `lastAthleteId` only follow OAI or documented This Week rules.  
4. **Introduce Training Proof lane** — worker + parent publish + coach consume; **do not** ship raw session sync.  
5. **Remove legacy assumptions** — code paths that infer athlete from weekly keys, competition picker, or routes without user commit.  
6. **Backward compatibility** — keep `kidId` + `sharedAthleteId` lineage joins until all stores backfilled; orphan detection read-only for QA.

---

## 9. QA implications

Future test matrix categories (each maps to sections above):

| Category | Validates |
|----------|-----------|
| **Authority** | OAI-only mutation paths; no route/cache side effects. |
| **Lineage** | `useAthleteData` matches sessions by `sharedAthleteId` and linked `kidId`; relink orphans handled. |
| **Replication** | Training Proof present/absent; coach never invents parent sessions. |
| **Hydration** | Order §5.5; cold start, upgrade, corrupt storage. |
| **Selection** | Selector, onboarding, coach bootstrap. |
| **Sync** | Weekly/competition fetch does not change OAI. |
| **Fallback** | §4 allowed vs forbidden cases. |

Traceability: every bug report should state **which plane** violated the spec.

---

## 10. Answers to required questions

1. **Can `activeKidStore` ever be authoritative again?** **No** for OAI. It may remain a **synchronous UI mirror** for `Kid.id` derived from OAI or explicit This Week derivation — never the root of truth for “which athlete.”

2. **Can route params mutate active athlete?** **Not implicitly.** Only through explicit user action that calls the canonical athlete setter.

3. **Is `Kid.id` or `sharedAthleteId` canonical for routing?** **`Kid.id`** for **route segments** that address a roster row (`/coach/kid/[kidId]`). **`sharedAthleteId` (== OAI)** for **global athlete identity**, sync keys, and Summary scope. Deep links choose **row routes** by `Kid.id`; product resolves to OAI via linkage.

4. **When roster and athlete plane diverge?** Roster row missing `sharedAthleteId` → no linked kid; weekly/competition may be partial; UI shows repair/onboarding states. OAI still valid for parent-only data. **No automatic OAI deletion** from roster drift alone.

5. **What survives reconnect?** OAI, roster, local sessions/competitions, caches **as data**; reconnect refreshes **remote-backed** content for **unchanged** OAI.

6. **What survives unlink?** Roster linkage may clear; competitions may show mismatch flags; OAI persists until user picks another athlete or deletes profile — explicit policy for “orphan” training rows.

7. **What survives worker partial payloads?** Proof aggregates must be **versioned** and **monotonic**; partial updates apply only to fields present; never infer OAI from partial payload.

8. **What survives stale cache?** Stale **weekly text** may display with wrong **freshness** but not wrong **athlete association**; if association unknown, discard cache.

9. **What does coach actually own?** Roster rows, coach-authored weekly, coach local sessions, standing guidance drafts, publish metadata — **not** parent OAI and **not** parent raw training.

10. **What is “Athlete Intelligence” as a first-class system?** The **derived** layer (signals, Summary VM, alignment/progression) that consumes **OAI-scoped** inputs and replicated proof — **never** a second authority on **who** the athlete is.

---

## 11. End-to-end narrative (success criterion)

**“How does athlete authority flow from app boot to Summary rendering?”**

1. **Boot:** Load role → load `parentAthletes` → load **OAI** from `parentActiveAthleteId` → validate against list → repair if needed (§4) → persist repair once.  
2. **Mirror:** Derive `linkedKidId` from `kidsById` + OAI (`sharedAthleteId` match); sync `activeKidStore` for parent convenience.  
3. **Data plane:** `useAthleteData(OAI, linkedKidId)` loads sessions (lineage) and competitions scoped to athlete.  
4. **Weekly:** Resolve weekly doc for OAI; cache is read **after** OAI fixed.  
5. **Intelligence:** `useSignals` / `buildSummaryViewModel` consume scoped inputs only.  
6. **Render:** Summary shows **one** coherent story for **one** OAI; coach shows proof-empty until Training Proof exists — **by design**, not bug.

**Deterministic ownership chain:** `parentAthletes` + `parentActiveAthleteId` → derived roster link → scoped stores → derived intelligence → UI.

---

## Document control

- **Version:** 0.1 (P0.5 canonical)  
- **Supersedes:** ad-hoc assumptions in scattered comments where they conflict.  
- **Related:** `docs/dev-handoff.md` (Recommendation A), `src/identity/resolveIdentity.ts`, `src/hooks/useActiveAthlete.ts`, `src/storage/athleteStore.ts`, `src/state/activeKidStore.ts`.
