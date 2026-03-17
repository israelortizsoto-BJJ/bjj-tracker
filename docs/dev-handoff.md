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
Build 7/8 tab exposure is now intentional for tester-facing product clarity:
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
**Date:** 2026-03-17  
**Status:** Build 8 is now live in TestFlight, includes the fuller Build 7 tab exposure in production, and the highest-ROI next move is tester feedback triage rather than new feature expansion.

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `34aa1d9` — Chore: remove unused profile date formatter

## What we completed most recently

### 1) Used real-device feedback to choose the next slice
We validated that session logging felt stronger and more robust, especially for:
- multiple techniques in one session
- custom technique entry
- YouTube link attachment
- image attachment

That feedback also exposed an important product mismatch:
- production/TestFlight did not yet show the fuller Build 7 surface area
- Welcome / Fundamentals / Gear were visible in dev but not in production

### 2) Corrected production tab exposure
We updated production/non-dev tab visibility so the external/TestFlight build now reflects the intended fuller product surface:
- Welcome
- Profile
- Training
- Fundamentals
- Gear

We intentionally kept these hidden:
- Dev Settings
- Coach Share routes
- training/[id]
- health

### 3) Tightened Profile helper text
We simplified the Last Promotion Date helper area so it is less noisy and more readable:
- kept one concise format hint
- removed the extra Display line
- removed the extra Example line

### 4) Kept Coach Share contained
We explicitly did not broaden Coach Share exposure in production.
Coach Share remains a narrow pilot lane until product coherence improves.

### 5) Shipped Build 8
We validated the slice in MatMind Dev, cleaned the repo lane, removed unrelated website artifacts, fixed the final dead-code warning, and shipped the next production/TestFlight build.

Confirmed:
- Build 8 is live
- Build 8 has early downloads
- the next meaningful signal source is tester behavior and feedback

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
- production tab exposure now matches the intended fuller Build 7 story
- Profile helper text is cleaner
- Coach Share remains intentionally contained
- Build 8 is live in TestFlight

## Commits landed most recently
- `34aa1d9` — Chore: remove unused profile date formatter
- `9ab2d08` — Feat: expose Build 7 tabs in production and tighten profile helper text
- `40ca82a` — Docs: update Build 7 EOD recap and handoff
- `e0e1521` — Docs: add project core files map
- `60ee2e7` — Docs: refresh handoff and definition of done

## Locked product / workflow decisions
- Terminal-first execution remains a hard project rule
- Repo/config truth should be checked before relying on stale handoff assumptions
- External/TestFlight should now reflect the fuller Build 7 tab story
- Coach Share remains a narrow pilot lane, not a broad external-facing feature yet
- Tester feedback should now drive the next fix list
- Do not open a broad cleanup or polish sprint without evidence

## Open loops
- Gather real tester feedback from Build 8
- Classify each issue as blocker / minor / follow-up
- Validate whether Welcome / Fundamentals / Gear improve tester comprehension externally
- Decide whether any Build 8 issues materially affect release confidence
- Later polish candidates:
  - Welcome branding hierarchy / logo prominence
  - shared top spacing on Profile / Fundamentals / Gear
  - cleaner title for `training/[id]`
  - Coach Share information hierarchy

## Best next-session recommendation
Next likely moves:
- gather Build 8 tester feedback and classify each issue as blocker / minor / follow-up
- fix only issues that materially affect release confidence or app comprehension
- avoid broad new feature work until feedback shows where the real friction is
- preserve Coach Share as a narrow pilot lane without broadening scope

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`
- `sed -n '1,260p' "docs/recaps/2026-03-13_dev-recap.md"`

## Assumptions
- I treated Build 8 early downloads as enough evidence to shift the next priority toward tester-feedback triage.
- I assumed broad new feature work would be lower ROI than responding to real external/tester signals.
