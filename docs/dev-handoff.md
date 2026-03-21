# BJJ Tracker —
Action: think-hard look through this Developer Handoff notes, plan out the day. If you are making assumptions, tell me when you are doing so. Let's get to work

## Non-negotiable: Dev/TestFlight coexistence.
Keep two separate bundle IDs forever:
- Prod/TestFlight: `com.ortizdigitalstudio.matmind`
- Dev: `com.ortizdigitalstudio.matmind.dev`

Never overwrite the TestFlight app with dev installs again.
Keep Xcode target stable across variants.
Do not change Expo name per variant (can break Xcode targets / EAS).
Use `ios.infoPlist.CFBundleDisplayName` for the Dev icon label (“MatMind Dev”).

## TestFlight is “beta reality.”
Nothing affects testers until we ship a new TestFlight build.
Validate bugs in TestFlight whenever possible, not only in Dev.

## Feature flags stay (but “code flags,” not build CLI flags).
Keep dev-only flags persisted locally (AsyncStorage) and guarded by `isDev()`.
Flags live under `src/config/*` and are toggled in Dev Settings.
Do not rely on EAS/Expo prebuild CLI flags for product behavior.

## Dev tooling lives in Dev Settings, not onboarding flows.
Avoid putting dev-only navigation inside Welcome/onboarding screens (redirect logic causes loops).
Use Dev Settings “Dev Shortcuts” to reach hidden routes.

## Hidden routes stay hidden from the tab bar by default unless intentionally exposed in dev.
Use `href: null` for internal routes and Coach Share subroutes.
Coach Share should still remain reachable from Profile, not as a main tab. For the dedicated TestFlight coach-testing lane, Coach Share can be exposed from `Profile` while remaining hidden by default otherwise.
Tester-facing tab exposure is now intentional for product clarity:
- Welcome
- Profile
- Training
- Fundamentals
- Gear

## Terminal-first workflow is the default.
Prefer terminal-driven, repeatable edits and commands wherever practical.

**Black Belt / coach feedback TestFlight lane** (Coach Share visible, same prod bundle ID): `npm run build:ios:feedback` → then `npm run submit:ios:feedback`. Full preflight, ASC audience rules, and prod vs feedback distinction: `docs/release-checklist-ios.md` (section *Black Belt / coach feedback build*).
Minimize manual editor changes.
If a task is not easy to do from terminal, treat that as a workflow gap to fix rather than a reason to default to hand-editing.
Use Cursor in a supervised workflow with terminal-visible commands, scoped diffs, gates, and intentional commits.

## No ad-hoc patching as a default workflow.
Avoid brittle regex/sed/perl “injection” edits for features.
Prefer clean, intentional file edits + TS/ESLint gates + clear commits.
Only use patching as emergency repair, not normal iteration.

## Gates are the source of truth (not Cursor summaries).
Always run:
- `npx tsc --noEmit`
- `npx eslint .`

before pushing meaningful app changes.

## Avoid reintroducing router landmines.
Screen names must be unique in `app/(tabs)/_layout.tsx`.
Do not let hidden/internal routes leak into the visible tab bar.

## Operational note to keep running:
When connecting Dev Client:
- Mac + iPhone on same hotspot/Wi-Fi
- macOS Firewall off or allow Metro/Node

Keep a dedicated build terminal untouched while EAS runs; use a separate tab for edits.

---

# BJJ Tracker — Developer Handoff Notes

**Project:** BJJ Tracker / MatMind Jiu Jitsu  
**Branch:** `dev`  
**Repo:** `israelortizsoto-BJJ/bjj-tracker`  
**Date:** 2026-03-20  
**Status:** Build 12 is the current coach-testing build in TestFlight. Feedback triage is intentionally tabled short-term. On `dev`, the **coach kid profile** is now **guidance-first** (standing **What matters next** + weekly focus + **How it’s going** check-ins + training + competition), with **hardened edit routes**, **swipe-to-delete** on key kid-detail rows, and **shared storage helpers** for row deletes. Same beta reality as before: **not** implied in TestFlight until a new build ships. Surfaces remain **pilot/hidden** (Profile → Coach Share → Kids).

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `89f0813` — Add shared delete helpers for coach kid row actions

## Process note (2026-03-20)
This coach kid profile batch used a **small slice → manual QA → fix** loop (repeat), rather than a single large drop.

## What we completed most recently

### 0) Coach kid profile: standing guidance, guidance-first stack, swipe deletes (`56f7b43` → `89f0813`)
- **Standing guidance — “What matters next”** (`kidStandingGuidanceStore`, `what-matters-next`): per-kid headline + optional detail; **top card** on kid detail; cleared when the kid is roster-deleted.
- **Guidance-first top stack** on kid detail: *What matters next* → *This week’s focus* → *How it’s going* (outcome + append-only **check-ins** + this-week list) → *This week’s training* → *Competition*.
- **Lower-half simplification**: compact summary cards; week lists **cap at 3 rows** with overflow to **History** / **Training** where relevant.
- **Editability**: `weekly-focus` and `competition/edit` support **`entryId`** for in-place edits; **`progress-reflection`** screen for editing a saved check-in; **`history`** opens the correct editor (focus vs check-in) per row.
- **Swipe-to-delete** (kid detail): saved **check-ins**, **this-week training sessions**, and **competition** rows — confirm, then persist.
- **Shared delete helpers**: `deleteKidWeeklyFocusEntryById` (`coachKidStore`) and `deleteSessionById` (`sessionsStore`) back the swipe paths and keep persistence aligned with the training editor / weekly-focus log.
- **Tab layout**: hidden routes registered for `what-matters-next` and `progress-reflection` (`app/(tabs)/_layout.tsx`).

### 1) Coach Share kid tracking flow + weekly focus history (`13f09f5`)
- **Kids roster** (`/profile/coaches/kids`): add a kid, list pilot roster, **swipe-to-delete** with confirmation.
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **this week** focus (latest log for Monday-week), **Set / edit this week’s focus** → `weekly-focus` (templates + custom; **append-only** logs; **edit via `entryId`** when improving an existing row), **History** → `history` (grouped by week, expandable; opens appropriate editor).
- **How it’s going (was: progress reflections on detail)**: outcome chips + notes on kid detail append **check-ins** for the week (append-only); gated on having a focus saved for the week. Tap a row → `progress-reflection`; swipe → delete check-in.
- **`coachKidStore`**: `KidsById` + `kidWeeklyFocusEntries` in AsyncStorage; caps (e.g. 60 focus rows/kid); weekly focus rows removed when a kid is hard-deleted (see `9fb7e3a` cascade). Roster hard-delete also removes **standing guidance** (`deleteKidPilot` order: competitions incl. media → linked training sessions → weekly focus → standing guidance → roster).

### 2) Kid competition tracking + roster hard-delete (`9fb7e3a`)
- **Competition** on kid detail: month-grouped list; **Add/edit** via `competition/edit` (tournament name, date, result, notes, optional video).
- **`kidCompetitionStore`**: create/update/delete; per-kid cap (60); **best-effort delete of persisted video files** when entries are removed or a kid is deleted.
- **`persistCameraRollMedia`**: copy picked camera-roll media into `documentDirectory/media/` (same pattern as training sessions); `bestEffortDeletePersistedMedia` for cleanup.
- **Roster delete** (`deleteKidPilot`): ordered cleanup **competitions (incl. media) → linked training sessions (kidId) → weekly focus → standing guidance → roster** to avoid orphan `kidId`s and stray pilot data.

### 3) Kid training linkage + progress reflections (`ab85fcd`)
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **This week’s training** with CTA to log via `/training/new?date=...&kidId=...`; session rows open the training editor; **swipe** deletes via `deleteSessionById`.
- **Training tab** (`app/(tabs)/training.tsx`): when `kidId` param is present, sessions are filtered to that kid and the “Add Session” CTA preserves `kidId`.
- Session editor (app/(tabs)/training/[id].tsx): persists kidId on the saved session so kid linkage survives navigation.
- **Check-ins / reflections**: this-week list on kid detail reflects saved check-ins; deep-edit on `progress-reflection`.

### 4) Still in place from prior Coach Share pilot work (unchanged intent)
Parent-first Coach Share hierarchy, coach pilot preview quality, **custom focus** in templates, and **reference link** support (**YouTube + Instagram**) on the template/preview path.

## What passed

### Gates
- `npx tsc --noEmit` passed (current `dev` HEAD)
- `npx eslint .` passed (current `dev` HEAD)

### Production config validation
Validated:
- `name = MatMind Jiu Jitsu`
- `ios.bundleIdentifier = com.ortizdigitalstudio.matmind`
- `extra.appVariant = prod`

### Product / release validation
Validated:
- Build 12 is the current coach-testing build in TestFlight
- **Kid roster / standing guidance / weekly focus / check-ins / kid-linked training / competition + swipe row deletes:** exercised via **Dev / local pilot** (not stated as live in the current TestFlight build)
- Coach Share pilot remains intentionally contained/hidden
- Coach Share pilot preview is cleaner (debug data hidden; clearer preview state)
- Custom focus is supported in Coach Share templates and preview
- Reference link pill supports YouTube + Instagram links

## Commits landed most recently
- `89f0813` — Add shared delete helpers for coach kid row actions  
- `084b355` — Standardize coach kid row deletion with swipe actions  
- `4532ca7` — Refactor coach kid top stack into guidance-first hierarchy  
- `56f7b43` — Feat: add coach guidance hero and harden kid pilot editing flows  
- `ab85fcd` — Feat: add kid training linkage and progress reflections  
- `9fb7e3a` — Feat: add kid competition tracking and roster delete  
- `13f09f5` — Feat: add Coach Share kid tracking flow and weekly focus history  
- `ca25164` — Docs: finalize handoff after Coach Share pilot work  
- `c2daab1` — Docs: update handoff for Coach Share pilot progress  
- `469ea58` — Feat: add custom focus option to Coach Share templates  
- `745059e` — Feat: expand Coach Share pilot preview with custom focus and IG links  

## Locked product / workflow decisions
- Terminal-first execution remains a hard project rule
- Build 12 is the current coach-testing build in TestFlight (beta reality)
- Feedback triage is intentionally tabled short-term
- Coach Share remains **hidden/pilot-scoped** (not a broad tester-facing feature yet)
- **Coach Share pilot + per-kid tracking** is the highest-ROI lane for Kyle internal testing (local pilot / Dev until we ship a new build)
- Kid roster / weekly focus / competition + kid-linked training session data is **local-only (AsyncStorage + on-device media copies)** for the pilot; not synced

## Open loops
- Kyle internal testing: run the **full kid pilot path** including **What matters next**, **edit this week’s focus** (existing row), **History** editor routing, **check-ins** (save + **swipe delete**), **log training** + **swipe delete session**, **competition** (optional video + **swipe delete**), and **roster delete** — confirm UX + cascade cleanup (incl. standing guidance + kid-linked sessions).
- **Deferred / unchanged intent:** broader Coach Share template/parent preview polish, collapsible long check-in lists, extra taxonomy items, and resuming **external** feedback triage — still tabled until this lane is stable.
- Validate **video pick → persist → playback** across devices/OS versions (MediaLibrary resolution for `ph://` / `assets-library://` when needed)
- Validate **caps** behavior (60 weekly focus rows/kid, 60 competitions/kid) under heavy use
- Coach Share template lane: parent-first hierarchy, multi-item preview, custom focus, YouTube + Instagram reference links (formatting + tap behavior)

## Best next-session recommendation
Next likely moves:
- Re-run gates (`npx tsc --noEmit`, `npx eslint .`) before further app changes or a TestFlight cut
- Dev QA: **Kids (Pilot)** → create kid → **What matters next** (add/edit/clear via empty save) → **Set / edit this week’s focus** → **History** (open row → correct editor) → **How it’s going** (save check-in, **swipe delete** check-in) → **Log session** + **swipe delete** from kid detail → **Competition** (add, edit via row tap, **swipe delete**) → **swipe delete kid** on roster and confirm cascade (incl. standing guidance + media)
- Keep Coach Share **pilot-hidden**; treat issues as pilot-blocking only if they break Kyle’s internal test
- Resume external feedback triage only when we’re ready to act on it

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`
- `sed -n '1,200p' "docs/recaps/2026-03-20_dev-recap.md"`

## Assumptions
- Kyle internal **Coach Share + kid pilot** usability remains the highest-ROI signal for this lane.
- Broader external feedback triage can stay tabled until this pilot lane is stable enough for internal use.
- Gates above reflect the **current `dev` HEAD**; re-run before pushing if the tree changes.
