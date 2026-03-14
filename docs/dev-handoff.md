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
Coach Share should still remain reachable from Profile, not as a main tab.
Build 7 dev tab exposure is intentional for QA:
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
**Date:** 2026-03-13  
**Status:** Build 7 has passed release-readiness, project continuity docs have been refreshed against repo truth, and a production iOS build is now live on-device for real validation.

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `e0e1521` — Docs: add project core files map

## What we completed today

### 1) Re-grounded the project from repo truth
We stopped relying on stale assumptions and re-read the actual repo structure, config files, routing shell, and operating docs.

This confirmed:
- the app is still Expo + Expo Router based
- EAS config is still active in the repo
- dev/prod variant separation is implemented in app.config.ts
- the current release lane should be driven by repo/config truth, not stale summaries

### 2) Documented Build 7 release-readiness clearly
We completed and saved a dedicated Build 7 release-readiness pass.

That pass concluded:
- Build 7 is ready for internal release-readiness
- no ship blockers were found
- remaining issues are polish / coherence follow-ups, not blocker-level defects

Saved doc:
- `docs/qa/build-7-release-readiness-pass-2026-03-13.md`

### 3) Repaired continuity-doc drift
We updated the docs that had drifted away from the actual repo state.

This included:
- `docs/definition-of-done.md`
- `docs/dev-handoff.md`
- `docs/project-core-files.md`

Result:
future restart flow should now be cleaner and less dependent on memory.

### 4) Advanced the production release lane
We validated local production config and gates, authenticated to the correct Expo/EAS account, verified remote build numbering, and produced a successful production iOS build.

Confirmed:
- Expo/EAS account: `iortizsoto`
- remote iOS production build number before build: `6`
- Build 7 production build completed successfully
- Build 7 is now live on-device for real testing

## What passed

### Gates
- `npm run typecheck` passed
- `npm run lint` passed

### Production config validation
Validated:
- `name = MatMind Jiu Jitsu`
- `ios.bundleIdentifier = com.ortizdigitalstudio.matmind`
- `extra.appVariant = prod`

### Product / release validation
Validated:
- Build 7 release-readiness pass completed
- project continuity docs now align more closely with repo truth
- production iOS build completed successfully
- Build 7 is live on-device for real validation

## Commits landed today
- `60ee2e7` — Docs: refresh handoff and definition of done
- `e0e1521` — Docs: add project core files map

Recent supporting commits still relevant to current state:
- `1d126a1` — Fix: correct hidden tab const assertion
- `0772623` — Docs: add Build 7 release readiness pass
- `6fd0261` — Docs: add terminal-first workflow rule

## Locked product / workflow decisions
- Terminal-first execution is now a hard project rule
- Repo/config truth should be checked before relying on stale handoff assumptions
- Build 7 is ready for internal release-readiness
- Pre-release polish should remain constrained; do not broaden scope before validation
- Coach Share remains a narrow pilot lane, not a broader expansion target right now

## Open loops
- Complete real-device feedback pass on Build 7
- Decide whether any on-device issues are blockers, minor issues, or follow-ups
- Later polish candidates:
  - Welcome branding hierarchy / logo prominence
  - shared top spacing on Profile / Fundamentals / Gear
  - cleaner title for `training/[id]`
  - Coach Share information hierarchy
- Decide whether `docs/ods-website-rebuild-proposal.md` belongs in this repo/workstream or should stay separate
- Later cleanup option:
  - remove stale/ignored local `ios.buildNumber` from app config since remote versioning is the source of truth

## Best next-session recommendation
Next likely moves:
- gather real on-device Build 7 feedback and classify each issue as blocker / minor / follow-up
- fix only real release-confidence issues found during internal validation
- keep logged polish items constrained and avoid opening a broad cleanup sprint
- preserve Coach Share as a narrow pilot lane without broadening scope

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`
- `sed -n '1,260p' "docs/recaps/2026-03-13_dev-recap.md"`

## Assumptions
- I treated repo/config truth as higher priority than stale handoff summaries.
- I assumed Build 7 real-device testing should drive the next fix list rather than opening a broad polish sprint first.
