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

## Hidden routes stay hidden from the tab bar by default.
Use `href: null` for dormant routes (Health/Gear/Fundamentals/Coach scaffolds).
Access via Dev Shortcuts/flagged entry points, not visible tabs.

## No ad-hoc patching as a default workflow.
Avoid brittle regex/sed/perl “injection” edits for features.
Prefer clean, intentional file edits + TS/ESLint gates + clear commits.
Only use patching as emergency repair, not normal iteration.

## Gates are the source of truth (not VS Code/Cursor squiggles).
Always run:
- `npx tsc --noEmit`
- `npx eslint .`

before pushing meaningful app changes.

## Avoid reintroducing router landmines.
Screen names must be unique in `app/(tabs)/_layout.tsx`.
Don’t resurrect `jj101` (explicitly removed).

## Deprecation posture (planned + controlled).
Replace deprecated `SafeAreaView` with `react-native-safe-area-context` (done).
`expo-av` migration is planned (`expo-audio` / `expo-video`) — don’t rush into half-migrations.

## Operational note to keep running:
When connecting Dev Client:
- Mac + iPhone on same hotspot/Wi-Fi
- macOS Firewall off or allow Metro/Node

Keep a dedicated “build terminal” tab untouched while EAS runs; use a separate tab for edits.

---

# BJJ Tracker — Developer Handoff Notes

**Project:** BJJ Tracker / MatMind Jiu Jitsu  
**Branch:** `dev`  
**Repo:** `israelortizsoto-BJJ/bjj-tracker`  
**Date:** 2026-03-10  
**Status:** app code clean and pushed; local untracked `.cursor/` remains for trial setup only

## Git checkpoint
**Working tree:**
- synced to `origin/dev`
- only local untracked folder: `.cursor/`

**Latest commit:**
- `7ad404a` — Feat: add empty state for Training week view search

## Commits completed today
- `7ad404a` — Feat: add empty state for Training week view search
- `e599d3f` — Docs: add MatMind master prompt templates
- `2343ba9` — Docs: update dev recap and lock iOS release flow
- `19bb8e9` — Docs: add dev recap flow and update handoff ritual

## What we completed today

### 1) Cursor adoption setup — controlled trial foundation

**Action:** began controlled Cursor adoption for MatMind dev workflow.  
**Why:** test whether Cursor can become the stronger coding lane without disrupting release cadence or blurring Dev/TestFlight lanes.

**Completed:**
- installed Cursor on Mac
- enabled `cursor` CLI in PATH
- validated repo opens correctly from terminal with `cursor .`
- fixed GitHub HTTPS auth cleanly by replacing expired token flow
- pushed local docs commits successfully after auth reset
- created local Cursor repo rule structure under `.cursor/rules/`
- kept Cursor in supervised mode:
  - review before apply
  - no broad refactors
  - terminal-first verification

**Important note:**
- `.cursor/` is currently **local only** and **not committed**
- decision still pending on whether Cursor rules should become repo-tracked convention or remain local

### 2) First real Cursor product task — Training week empty state

**Action:** used Cursor for one supervised, low-risk real product edit.  
**Why:** validate Cursor on actual app work, not just docs or theory.

**Completed in** `app/(tabs)/training.tsx`:
- added derived `weekHasVisibleSessions`
- fixed Week view blank-state problem when search/filter hides all sessions
- added explicit empty-state messaging:
  - “No sessions match your search”
  - “No sessions this week yet”

**Why this mattered:**
- Week view previously became blank with no explanation
- this was a real UX improvement with tight scope and low risk

### 3) Validation loop — Cursor task passed real app test

**Action:** verified the change in app before commit.  
**Why:** Cursor changes should only be committed after app-level proof, not just diff review.

**Tested successfully:**
- Training → This Week
- entered a search that matched nothing
- confirmed empty-state message appeared
- cleared search
- confirmed normal session list returned

**Result:**
- first supervised Cursor product task passed
- diff stayed contained to one file
- commit and push completed cleanly

---

## Locked decisions from today

### Cursor lane decision
Cursor is now approved for **controlled supervised use** on MatMind.

That means Cursor is approved for:
- small UI polish
- contained UX improvements
- localized bug fixes
- single-screen work
- 1–3 file tasks
- terminal-first verified edits

Cursor is **not yet** approved for:
- broad refactors
- storage/model changes
- release-critical work
- EAS/TestFlight/config work
- unsupervised edits
- app-wide cleanup passes

### Cursor workflow rules to preserve
For now:
- always start from terminal at repo root
- validate `git status -sb` before work
- make Cursor explain plan before editing
- review diff before accepting
- test in app before commit
- commit only after verification
- keep `.cursor/` local until intentionally decided otherwise

### Network/testing rule reaffirmed
For Expo/dev client testing:
- Mac + iPhone must be on same Wi-Fi or same hotspot
- firewall must not block Metro/Node

---

## What passed in app today

### Training
- Week view now shows a clear empty state when search hides all sessions
- clearing search restores visible sessions correctly
- no routing/storage/build side effects observed from this change

### Workflow / tooling
- GitHub auth fixed and working again for HTTPS push
- `cursor` CLI installed and working
- repo opens cleanly in Cursor from terminal
- controlled review/apply flow worked as intended

---

## Product / engineering decisions to preserve

### Cursor adoption
This is **not** full migration yet.
This is a controlled proving phase.

Interpretation:
- Cursor earned continued use
- Cursor did **not** yet earn full takeover of all coding work
- VS Code remains fallback lane until Cursor proves itself on more tasks

### Review standard
Do not accept Cursor-generated changes blindly.
Always require:
1. task understanding
2. exact files impacted
3. smallest safe fix
4. verification plan
5. app test before commit

### Scope discipline
Prefer first-trial style tasks:
- local
- reversible
- obvious before/after
- minimal blast radius

Avoid starting Cursor on:
- routing changes
- storage migrations
- config/build changes
- large UI architecture cleanup
- hidden route / onboarding navigation work

---

## Outstanding items

### Highest priority workflow item
Decide what to do with local `.cursor/`:
- keep local only
- or intentionally commit project rules later

Do **not** commit it casually.

### Highest priority product continuation
Run **task two** of Cursor trial on another contained but slightly more reasoning-heavy app task.

Best next category:
- one slightly more logic-aware UI task
- or one contained bug fix with tight scope

### Existing product lanes still open
- Coach Share real join/manage logic
- parent completion/adherence flow
- media parity for Coach Share
- Profile internal cleanup/refactor
- broader Training polish from tester feedback

---

## Recommended next work session

### Option 1 — Cursor trial task two
**Action:** use Cursor on one more contained real product task.  
**Why:** it passed task one; now it needs to prove repeatability.

**Good fit:**
- one localized Training/Profile bug fix
- one UI/validation improvement
- max 1–3 files
- no build/release/storage/routing work

**Goal:** determine whether Cursor is consistently cleaner/faster than VS Code lane.

### Option 2 — Return to locked product priorities
**Action:** continue product work outside the migration lane.  
**Why:** do not let tooling exploration swallow product momentum.

**Best candidates:**
- Coach Share parent completion/adherence scaffold
- Profile cleanup with no UX drift
- Training feedback pass only after locking decisions first

---

## Best next-step recommendation

Start next session with:
1. `git status -sb`
2. `git log -5 --oneline`
3. keep `.cursor/` untracked
4. run **one more supervised Cursor task**
5. judge whether Cursor stays cleaner than your current lane for a second consecutive real app task

## Assumptions I made
- I assumed today’s meaningful app work was the Cursor setup/auth reset plus the Training week empty-state change.
- I assumed you wanted the handoff notes updated from the last manual version you pasted, rather than a full doc-file diff from `docs/`.
- I did **not** include session times because you did not provide them.
