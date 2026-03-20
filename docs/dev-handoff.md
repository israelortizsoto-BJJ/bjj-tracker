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
**Date:** 2026-03-19  
**Status:** Build 12 is the current coach-testing build in TestFlight. Feedback triage is intentionally tabled short-term. The **Coach Share pilot lane** now includes **per-kid tracking** on `dev` (roster, weekly focus logging/history, kid-linked training sessions, progress reflections (Outcome/Notes), competition log with optional on-device video, roster delete with cascade cleanup)—**validated in Dev / local pilot flows**; **not** implied shipped to testers until we cut a new TestFlight build. Surfaces remain **pilot/hidden** (Profile → Coach Share).

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `ab85fcd` — Feat: add kid training linkage and progress reflections

## What we completed most recently

### 1) Coach Share kid tracking flow + weekly focus history (`13f09f5`)
- **Kids roster** (`/profile/coaches/kids`): add a kid, list pilot roster, **swipe-to-delete** with confirmation.
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **this week** focus (latest log for Monday-week), **Set Weekly Focus** → `weekly-focus` (templates + custom; **append-only** logs; fresh form each visit), **View History** → `history` (grouped by week, expandable).
- **Progress reflections (Outcome / Notes)**: saving on the kid detail appends coachOutcome/coachNotes onto this week’s focus context (append-only); gated on having a focus saved for the week.
- **`coachKidStore`**: `KidsById` + `kidWeeklyFocusEntries` in AsyncStorage; caps (e.g. 60 focus rows/kid); weekly focus rows removed when a kid is hard-deleted (see `9fb7e3a` cascade).

### 2) Kid competition tracking + roster hard-delete (`9fb7e3a`)
- **Competition** on kid detail: month-grouped list; **Add/edit** via `competition/edit` (tournament name, date, result, notes, optional video).
- **`kidCompetitionStore`**: create/update/delete; per-kid cap (60); **best-effort delete of persisted video files** when entries are removed or a kid is deleted.
- **`persistCameraRollMedia`**: copy picked camera-roll media into `documentDirectory/media/` (same pattern as training sessions); `bestEffortDeletePersistedMedia` for cleanup.
- **Roster delete** (`deleteKidPilot`): ordered cleanup **competitions (incl. media) → linked training sessions (kidId) → weekly focus → roster** to avoid orphan `kidId`s.

### 3) Kid training linkage + progress reflections (`ab85fcd`)
- **Kid detail** (`/profile/coaches/kid/[kidId]`): shows `This Week’s Training Sessions` and CTA to `Log Training for This Kid` via `/training/new?date=...&kidId=...`.
- **Training tab** (`app/(tabs)/training.tsx`): when `kidId` param is present, sessions are filtered to that kid and the “Add Session” CTA preserves `kidId`.
- Session editor (app/(tabs)/training/[id].tsx): persists kidId on the saved session so kid linkage survives navigation.
- **Progress reflections rendering**: kid detail “Saved weekly progress reflections (this week)” reflects what was saved on the `PROGRESS ON THIS WEEK’S FOCUS` flow.

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
- **Kid roster / weekly focus / competition + kid-linked training sessions + progress reflections:** exercised via **Dev / local pilot** (not stated as live in the current TestFlight build)
- Coach Share pilot remains intentionally contained/hidden
- Coach Share pilot preview is cleaner (debug data hidden; clearer preview state)
- Custom focus is supported in Coach Share templates and preview
- Reference link pill supports YouTube + Instagram links

## Commits landed most recently
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
- Kyle internal testing: run the **full kid pilot path** (roster → kid → weekly focus → history → log training for kid → outcome/notes → progress reflections → competition incl. optional video → entry delete) plus **roster delete** and confirm UX + data cleanup feels right (incl. kid-linked training session cleanup).
- Validate **video pick → persist → playback** across devices/OS versions (MediaLibrary resolution for `ph://` / `assets-library://` when needed)
- Validate **caps** behavior (60 weekly focus rows/kid, 60 competitions/kid) under heavy use
- Coach Share template lane: parent-first hierarchy, multi-item preview, custom focus, YouTube + Instagram reference links (formatting + tap behavior)
- Decide when to resume external feedback triage (after Kyle pilot signal / once this lane stabilizes)

## Best next-session recommendation
Next likely moves:
- Re-run gates (`npx tsc --noEmit`, `npx eslint .`) before further app changes or a TestFlight cut
- Dev QA: **Kids (Pilot)** → create kid → **Set Weekly Focus** (template + custom) → **View History** → **Log Training for This Kid** → **Save Outcome / Notes** → confirm “Saved weekly progress reflections (this week)” renders what was saved → **Add competition** (try optional video) → edit/delete entry → **swipe delete kid** and confirm related data + copied media cleanup
- Keep Coach Share **pilot-hidden**; treat issues as pilot-blocking only if they break Kyle’s internal test
- Resume external feedback triage only when we’re ready to act on it

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`
- `sed -n '1,260p' "docs/recaps/2026-03-13_dev-recap.md"`

## Assumptions
- Kyle internal **Coach Share + kid pilot** usability remains the highest-ROI signal for this lane.
- Broader external feedback triage can stay tabled until this pilot lane is stable enough for internal use.
- Gates above reflect the **current `dev` HEAD**; re-run before pushing if the tree changes.
