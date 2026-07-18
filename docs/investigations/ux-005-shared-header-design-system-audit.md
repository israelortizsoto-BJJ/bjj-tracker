# UX-005: Shared Header Design System — Evidence Audit

**Status:** Investigation only (no implementation)  
**Date:** 2026-07-17  
**Scope:** Primary application headers for Parent and Coach operating surfaces  
**Method:** Repository evidence first (route files, owning screens, shared header components, layout chrome). No UI changes, no refactors, no navigation changes, no component extraction.

---

## 0. Executive finding

MatMind already has a partial shared header (`OperatingHeader`) on the five primary tab roots, but it is not yet a product header system. Nested Athlete Detail and Competition Detail screens still use a second, incompatible chrome model (native stack title + in-content back button), and refresh affordances are fragmented across header buttons, pull-to-refresh, focus reloads, and a native “Refresh” text control that is layout-gated by lane.

This audit is sufficient to design one reusable header standard without guessing screen-by-screen.

---

## 1. Shared primitives (evidence)

| Primitive | Path | Role today |
|-----------|------|------------|
| `OperatingHeader` | `src/components/operating/OperatingHeader.tsx` | Primary in-scroll header: identity/team row + action group + eyebrow/title/subtitle |
| `HeaderActionGroup` / `HeaderAction` | same file | 36×36 icon buttons; optional non-pressable status dot |
| `CoachHeader` | `src/components/coach/CoachHeader.tsx` | Legacy title+subtitle only; **not** used by live Coach tab root |
| Tab chrome | `app/(tabs)/_layout.tsx` | All primary tabs: `headerShown: false` (OperatingHeader owns chrome) |
| This Week stack | `app/(tabs)/this-week/_layout.tsx` | Default `headerShown: true`; `index` opts out |
| Coach stack | `app/(tabs)/coach/_layout.tsx` | Default `headerShown: false` for entire coach lane |

`OperatingHeader` contract (props observed in production call sites):

- `mode`: `"athlete"` | `"team"`
- Optional: `density`, `surfaceTone`, `semanticLead`, `subtitle`, `onTitleLongPress`
- Left: athlete chip **or** team mark (`MM`) + label/meta
- Right: `actions[]` (icon label, optional `selected`, optional `statusColor`, optional `onPress`)

Screenshots were not captured in this pass. File references below are the authoritative visual/source anchors.

---

## 2. Inventory of every primary header

### 2.1 Parent — Summary

| Field | Evidence |
|-------|----------|
| Route | `/summary` → `app/(tabs)/summary/index.tsx` → `src/features/summary/SummaryScreen.tsx` |
| Header type | **OperatingHeader** (`mode="athlete"`, `semanticLead`) |
| Eyebrow | `Summary / Identity` |
| Title | `A mirror of the athlete` |
| Subtitle | none |
| Left | Athlete identity chip: name, initials, meta (belt/experience **or** coach-link trust copy **or** `Add belt & experience`), `identityHighlight` |
| Right actions | `⋯` Manage athlete · `+` Add athlete · `⚙` Profile/settings |
| CTA buttons in header | none (actions are icon buttons only) |
| Safe area | `SafeAreaView` `edges={["top"]}`; content padding `18` / top `20` |

**Action purpose**

| Action | Why it exists | Still necessary? | Same function elsewhere? |
|--------|---------------|------------------|--------------------------|
| `⋯` | Opens manage sheet (Edit Profile / Delete) | Yes — athlete admin home | Profile edit also via `/summary/profile`; no other tab exposes delete |
| `+` | Navigate `/summary/add-athlete` | Yes for multi-athlete | Coach Dashboard `+` goes to roster/links — **different meaning** |
| `⚙` | Device profile/settings | Yes | Same pattern on This Week, Training, Compete, Coach Dashboard |

**Refresh**

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Header refresh button | No | |
| Pull-to-Refresh | Yes | `RefreshControl` → `onSummaryRefresh` (weekly snapshot + `refreshActiveAthleteAuthority`) |
| Focus refresh | Yes | `useFocusEffect` → weekly session snapshot only (lighter than PTR) |
| Duplicate | Soft | Focus ≠ PTR depth (documented elsewhere as authority gap) |

**Navigation**

- Tab root (no back).
- Nested Summary stack screens use native headers (`app/(tabs)/summary/_layout.tsx`).

---

### 2.2 Parent — This Week

| Field | Evidence |
|-------|----------|
| Route | `/this-week` → `app/(tabs)/this-week/index.tsx` (`ParentThisWeekScreen`) |
| Header type | **OperatingHeader** (`mode="athlete"`) |
| Eyebrow | `Coach Direction` |
| Title | `This week’s direction` |
| Subtitle | none |
| Left | Athlete chip; meta `Linked athlete` / `Device athlete` |
| Right actions | `↻` Refresh · status dot (linked/not) · `⚙` Profile |
| Safe area | **Manual** `paddingTop: insets.top + 8` inside `KeyboardAwareScrollView` (no `SafeAreaView` on this path) |
| Dev-only | `onTitleLongPress` toggles debug data |

**Action purpose**

| Action | Why | Necessary? | Elsewhere? |
|--------|-----|------------|------------|
| `↻` | Force weekly/coach-share reload (`refreshParentData` / `forceWeeklySessionFetchRef`) | Yes today — **only tab root with explicit header refresh** | Kid Detail native “Refresh”; others use PTR |
| Status dot | Linked vs not linked | Useful signal; interaction model unique | Coach Dashboard also uses status dot (different meaning) |
| `⚙` | Profile | Yes | Shared |

**Refresh**

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Header refresh | **Yes** | Only primary OperatingHeader screen with `↻` |
| Pull-to-Refresh | **No** | No `RefreshControl` in this file |
| Focus refresh | Yes | `useFocusEffect` → `loadCoachShareData` |
| Duplicate | Header + focus both reload corridor; no PTR parity with other tabs |

**Navigation**

- Tab root for parent; coach role redirects away (`safeReplace` → `/coach`).
- Nested This Week screens inherit **native stack header** (`headerShown: true`).

---

### 2.3 Parent / shared — Training

| Field | Evidence |
|-------|----------|
| Route | `/training` → `app/(tabs)/training.tsx` |
| Header type | **OperatingHeader** (`mode="athlete"`, `surfaceTone="soft"`) |
| Eyebrow | `Training / Execution` |
| Title | `Day-based session log` |
| Subtitle | `Capture the work that shapes the next round.` |
| Left | Athlete chip; meta `Linked athlete` / `Device training` |
| Right actions | `▣` Week view (toggle/selected) · `+` Add session · `⚙` Profile |

**Action purpose**

| Action | Why | Necessary? | Elsewhere? |
|--------|-----|------------|------------|
| `▣` Week view | Sets `viewMode === "week"` | Partially — **duplicates** body “Today / Yesterday / This Week” chips | Compete uses non-pressable selected `▣` as decoration |
| `+` | `openNewSession` | Yes | Same glyph, different verb than Summary/Compete/Coach |
| `⚙` | Profile | Yes | Shared |

**Refresh**

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Header refresh | No | |
| Pull-to-Refresh | Yes | `RefreshControl` → local `refresh()` (AsyncStorage sessions) |
| Focus refresh | Yes | `useFocusEffect` → same `refresh()` |
| Duplicate | Focus + PTR call same loader (intentional redundancy) |

**Navigation**

- Tab root; session detail is hoisted hidden tab route `training/[id]`.

---

### 2.4 Parent / Coach — Compete (shared screen)

| Field | Evidence |
|-------|----------|
| Route | `/compete` → `app/(tabs)/compete.tsx` |
| Header type | **OperatingHeader** (`mode="athlete"`) — **same component for parent and coach** |
| Eyebrow | `Competition / Proof` |
| Title | `Events and matches` |
| Subtitle | none |
| Left | Athlete chip (or “No athlete selected”); meta `Linked athlete` / `Competition history` |
| Right actions | `▣` Competition view (**selected, no `onPress`**) · `+` Add competition · `⚙` Profile |

**Action purpose**

| Action | Why | Necessary? | Elsewhere? |
|--------|-----|------------|------------|
| `▣` selected | Visual “mode” affordance | **Questionable** — non-interactive; reads as a control | Training’s `▣` is interactive |
| `+` | Launch competition edit with navigation contract (`returnClass: "compete"`) | Yes | Different destination than Summary/Training `+` |
| `⚙` | Profile | Yes | Shared |

**Refresh**

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Header refresh | No | |
| Pull-to-Refresh | Yes | Parent: writer session snapshot + load; Coach: `refreshActiveAthleteAuthority` + load |
| Focus refresh | Yes | Parent runs same writer refresh corridor; coach loads competitions |
| Duplicate | Focus ≈ PTR for parent path; coach PTR deeper than focus |

**Navigation**

- Tab root for both roles.
- Opens lane-scoped edit: `/this-week/kid/.../competition/edit` or `/coach/kid/.../competition/edit`.

---

### 2.5 Coach — Dashboard

| Field | Evidence |
|-------|----------|
| Route | `/coach` → `app/(tabs)/coach/index.tsx` → `src/features/coach/CoachDashboardScreen.tsx` |
| Header type | **OperatingHeader** (`mode="team"`) |
| Eyebrow | `Team / Operations` |
| Title | `Coach Dashboard` |
| Subtitle | `Where coaching decisions are made.` |
| Left | Team mark `MM`, label `Team operations`, meta ``${n} active athletes`` |
| Right actions | `+` Roster/links · status dot “Team dashboard” · `⚙` Profile |
| Padding | `padding: 16` (tighter than Summary/Compete `18`) |

**Action purpose**

| Action | Why | Necessary? | Elsewhere? |
|--------|-----|------------|------------|
| `+` | `/coach/kids` roster & parent links | Yes, but glyph means “add” elsewhere | Kids roster also reachable from athlete flows |
| Status dot | Decorative “on team dashboard” | Low necessity | Parallel to This Week link status |
| `⚙` | Profile | Yes | Shared |

**Refresh**

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Header refresh | No | |
| Pull-to-Refresh | Yes | `useCoachInsights().onRefresh` |
| Focus refresh | Yes | `useFocusEffect` → `loadInsights` |
| Duplicate | Focus + PTR share load corridor |

**Navigation**

- Coach tab root (This Week tab hidden for coach role).
- Athlete rows → `/coach/kid/[kidId]`.

**Legacy note:** `src/features/coach/CoachScreen.tsx` + `CoachHeader` still exist (simple “Coach” title, no OperatingHeader) but are **not** the live `/coach` entry.

---

### 2.6 Coach — Athlete Detail (applicable)

| Field | Evidence |
|-------|----------|
| Route | `/coach/kid/[kidId]` → `src/features/kid/KidDetailScreen.tsx` |
| Header type | **Hybrid / dual model** |
| Native stack | Coach layout `headerShown: false` → native title/headerRight **not shown** |
| In-content left | Pressable `Back to Coach` → `router.replace("/coach")` |
| In-content title block | Eyebrow `Coach workspace` · title `{kidName}` · subtitle explanatory copy |
| Native headerRight (set always) | Text “Refresh” / “Refreshing…” via `navigation.setOptions` — **wired, but coach stack chrome hidden** |
| OperatingHeader | **Not used** |
| Pull-to-Refresh | **No** |
| Focus refresh | Yes (`load()`) |

Also used on parent lane `/this-week/kid/[kidId]` with different copy and `Back to Kids`, where **native stack header is shown** (`title: "Athlete"` + Refresh) **in addition to** in-content back/title → double chrome.

---

### 2.7 Competition Detail (applicable)

Competition “detail” in product terms is the edit/workspace screen, not the deep-link shim.

| Surface | Path | Header model |
|---------|------|--------------|
| Parent edit | `app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx` | Native stack title `Add/Edit Competition` **+** in-content `Back to Compete` |
| Coach edit | `app/(tabs)/coach/kid/[kidId]/competition/edit.tsx` | Coach stack `headerShown: false` → **no** native title; in-content `Back to Compete` only; `Stack.Screen` title set but not visible |
| Deep link shim | `app/competition/[id].tsx` | Transient native header `Competition` while resolving; replaces into lane edit |

No OperatingHeader on competition detail. No PTR on these editors (out of primary-header refresh scope, but relevant to interaction model drift).

---

## 3. Comparison matrix

| Screen | Header type | Actions (L→R) | Refresh method | Navigation pattern |
|--------|-------------|-----------------|----------------|--------------------|
| Parent Summary | OperatingHeader (athlete, semanticLead) | `⋯` manage · `+` add athlete · `⚙` | PTR + focus (weekly); PTR also authority | Tab root; nested native stack for subpages |
| Parent This Week | OperatingHeader (athlete) | `↻` refresh · status link · `⚙` | Header button + focus; **no PTR** | Tab root; nested native stack for children |
| Training | OperatingHeader (athlete, soft) | `▣` week · `+` session · `⚙` | PTR + focus (same loader) | Tab root |
| Compete (parent & coach) | OperatingHeader (athlete) | `▣` decorative · `+` competition · `⚙` | PTR + focus (role-branched depth) | Tab root → lane edit |
| Coach Dashboard | OperatingHeader (team) | `+` roster · status · `⚙` | PTR + focus | Tab root → athlete detail |
| Coach Athlete Detail | In-content title + back; native chrome **off** | Native Refresh set but hidden; in-content back | Focus load; header refresh dead on coach lane | `replace` to `/coach` |
| Parent Athlete Detail (This Week kid) | Native stack **+** in-content title/back | Native “Refresh” text | Focus + native Refresh; no PTR | `replace` to `/this-week/kids` |
| Competition Detail (parent) | Native stack **+** in-content back | Native back + `Back to Compete` | N/A (editor) | Contract exit to Compete |
| Competition Detail (coach) | In-content back only | `Back to Compete` | N/A (editor) | Contract exit to Compete |

---

## 4. Inconsistencies by severity

### P0 — Blocks a coherent product header without first deciding policy

1. **Two header systems in one product**  
   Tab roots: dark OperatingHeader. Nested athlete/competition: light/system native stack and/or light in-content cards. Parent nested routes often show **both**.

2. **Lane asymmetry for Athlete Detail refresh**  
   Same `KidDetailScreen` sets a native `headerRight` Refresh, but coach stack hides headers while This Week stack shows them. Coach athletes may only get focus reload; parents get an explicit Refresh control (plus duplicate in-content chrome).

3. **Refresh interaction model is not product-consistent**  
   - This Week: header `↻`, no PTR  
   - Summary / Training / Compete / Coach Dashboard: PTR, no header refresh  
   - Athlete Detail: native text Refresh (when visible), no PTR  
   Users cannot learn one “how do I refresh?” rule.

4. **Double back / double title on parent competition edit and parent kid detail**  
   Native back/title + in-content `Back to Compete` / `Back to Kids` + custom H1. Directly undermines “single cohesive product.”

### P1 — High friction / semantic confusion for a shared standard

1. **`+` is overloaded** across Add athlete / Add session / Add competition / Open roster. Same glyph, four jobs.

2. **`▣` is overloaded** — interactive week toggle (Training) vs inert selected badge (Compete). Violates control affordance honesty.

3. **Settings `⚙` is universal; athlete management is not** — only Summary exposes `⋯` / add-athlete. Intentional or accidental product asymmetry needs a standard.

4. **Safe-area ownership differs** — Summary/Training/Compete/Coach Dashboard use `SafeAreaView` top; This Week uses `insets.top + 8` manually. Risk of uneven top rhythm.

5. **Horizontal padding / hierarchy knobs differ** — Coach Dashboard `16` vs Summary/Compete `18`; only Training sets `surfaceTone="soft"` (styles currently near-identical); only Summary sets `semanticLead`; subtitle present only on Training + Coach Dashboard.

6. **Status dots mean different things** — This Week: link health; Coach Dashboard: “you are on dashboard.” Same visual language, different semantics.

7. **Compete is role-shared chrome with role-branched refresh depth** — header looks identical; PTR/focus behavior is not. Header standard must not pretend role parity where refresh corridors differ.

### P2 — Polish / taxonomy / cleanup after standard exists

1. Eyebrow taxonomy is poetic and inconsistent (`Summary / Identity`, `Coach Direction`, `Training / Execution`, `Competition / Proof`, `Team / Operations`).

2. Title voice mixes metaphor (`A mirror of the athlete`) with operational labels (`Coach Dashboard`, `Events and matches`).

3. Athlete meta strings diverge (`belt / experience`, `Linked athlete`, `Device training`, `Competition history`).

4. Legacy `CoachHeader` / `CoachScreen` remain as a parallel, simpler header language unused by live Coach tab.

5. Training week control exists twice (header `▣` and body day/week chips).

6. Deep-link competition shim uses light ActivityIndicator screen + native header — brief but off-system.

---

## 5. Recommendations ONLY (no implementation)

These are design-system decisions to lock before any UI work. Ordered for smallest blast radius.

### R1 — Adopt a two-slot header architecture (not one component for everything)

Define:

1. **PrimaryHeader** — tab roots and other “home” surfaces (today’s OperatingHeader family).  
2. **WorkspaceHeader** — pushed/replaced workspaces (Athlete Detail, Competition Detail): single back, single title, optional trailing action; **never** stack native + in-content duplicate.

Do not force Athlete Detail into OperatingHeader’s identity+eyebrow+triple-action pattern without a product decision — the workspace job is different.

### R2 — Freeze an action vocabulary before restyling

Propose a fixed action taxonomy for PrimaryHeader:

| Slot | Allowed jobs | Disallowed |
|------|--------------|------------|
| Trailing primary | Create-in-context (`add_*`) **or** refresh — pick one primary per screen | Mixing create + refresh as equal icon peers without priority |
| Trailing utility | Settings / overflow | Overloaded `+` for navigation that is not create |
| Status | Non-interactive truth only (link, sync) | Decorative “you are here” dots that look tappable |
| Mode toggle | Real toggles only | Selected-but-dead icons |

Resolve `+` with either labeled text CTAs or distinct icons per create domain.

### R3 — Choose one refresh policy for primary tabs

Recommended policy for MatMind (decision required):

- **Default:** Pull-to-Refresh on all primary ScrollViews.  
- **Optional header `↻`:** only when PTR is insufficient or discoverability-critical (candidate: This Week sync).  
- **Never:** three mechanisms (header + PTR + aggressive focus) without documenting which is authoritative for QA.

Athlete Detail should use the WorkspaceHeader trailing Refresh consistently on **both** lanes (coach + parent), or neither — eliminate layout-gated dead controls.

### R4 — Eliminate double chrome on nested This Week / Competition routes first

Smallest high-value consistency win after the standard is written:

- Parent lane: either native stack header **or** in-content back/title, not both.  
- Align coach competition edit visibility of title with parent once WorkspaceHeader exists.

This is a navigation-chrome policy, not a data/sync change.

### R5 — Normalize PrimaryHeader layout tokens without restyling cards

When implementing later:

- One safe-area owner.  
- One horizontal padding token for primary tabs.  
- One rule for eyebrow/title/subtitle presence.  
- Retire or quarantine `CoachHeader` so it cannot regress Coach tab language.

### R6 — Keep Compete as one PrimaryHeader; document role refresh differences outside the header

Do not fork Coach Compete vs Parent Compete headers for sync reasons. Encode role refresh depth in the refresh policy doc, not in divergent header chrome.

### R7 — Out of scope for UX-005 header standard (explicit)

- Summary athlete switcher body (below header).  
- Medal / competition card chrome.  
- Kids roster native “Kids roster” screens (related but secondary).  
- Changing focus vs authority refresh corridors (architecture; header only exposes UX entry points).

---

## 6. Proposed PrimaryHeader standard (draft for next design pass)

Enough evidence to draft without guessing:

```
[ Identity/Team chip .............. ActionCluster ]
[ Eyebrow ]
[ Title ]
[ Subtitle? ]
```

**ActionCluster (max 3):**

1. Context create **or** refresh (product chooses per screen class)  
2. Overflow / manage (Summary-class only, or promote elsewhere deliberately)  
3. Device settings (`⚙`) — keep universal if Profile remains the device hub  

**Screen class mapping (draft):**

| Class | Screens | Create | Refresh UI | Manage |
|-------|---------|--------|------------|--------|
| Identity home | Summary | Add athlete | PTR | Overflow |
| Delivery home | This Week | none | PTR (+ optional `↻` if retained) | none |
| Execution home | Training | Add session | PTR | none (week toggle not in ActionCluster — body chips own it) |
| Proof home | Compete | Add competition | PTR | none (drop decorative `▣`) |
| Team home | Coach Dashboard | Roster entry | PTR | none (drop decorative status) |
| Workspace | Athlete / Competition detail | N/A | Trailing Refresh | Single back |

---

## 7. File reference index

| Concern | Files |
|---------|-------|
| Shared header UI | `src/components/operating/OperatingHeader.tsx` |
| Legacy coach header | `src/components/coach/CoachHeader.tsx`, `src/features/coach/CoachScreen.tsx` |
| Summary | `src/features/summary/SummaryScreen.tsx` |
| This Week | `app/(tabs)/this-week/index.tsx` |
| Training | `app/(tabs)/training.tsx` |
| Compete | `app/(tabs)/compete.tsx` |
| Coach Dashboard | `src/features/coach/CoachDashboardScreen.tsx`, `src/features/coach/useCoachInsights.ts` |
| Athlete Detail | `src/features/kid/KidDetailScreen.tsx` |
| Competition edit | `app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx`, `app/(tabs)/coach/kid/[kidId]/competition/edit.tsx` |
| Layout chrome gates | `app/(tabs)/_layout.tsx`, `app/(tabs)/this-week/_layout.tsx`, `app/(tabs)/coach/_layout.tsx` |
| Prior surface map (partial) | `docs/coach-surface-responsibility-map.md` |

---

## 8. Success criteria check

| Criterion | Met? |
|-----------|------|
| Inventory of every in-scope header | Yes (§2) |
| File references (screenshot substitutes) | Yes (§1, §7) |
| Comparison matrix | Yes (§3) |
| Inconsistencies P0/P1/P2 | Yes (§4) |
| Recommendations only; no implementation | Yes (§5–§6) |
| Enough evidence for one reusable standard | Yes — PrimaryHeader + WorkspaceHeader + refresh/action vocabulary |

**Next step (not done here):** product sign-off on R2–R4 decisions, then a thin UX-005 design spec, then smallest-blast-radius implementation starting with nested double-chrome removal **or** PrimaryHeader token normalization — not both in one change.
