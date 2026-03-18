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
**Status:** Build 8 remains live in TestFlight. Feedback triage is intentionally tabled for now; today’s highest-ROI work was refining the **Coach Share pilot lane** for Kyle’s internal testing this week (still hidden/pilot-scoped).

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `c2daab1` — Docs: update handoff for Coach Share pilot progress

## What we completed most recently

### 1) Shifted near-term focus to Coach Share pilot refinement
Build 8 is live in TestFlight, but we intentionally tabled broad feedback triage for now. Highest-ROI work today was tightening the Coach Share pilot lane for Kyle’s internal testing this week.

### 2) Clarified the parent-first Coach Share hierarchy
We clarified the Coach Share flow so the parent route and copy read as the primary lane, with the coach pilot path clearly subordinate. Coach Share remains **hidden/pilot-scoped** (not broadened into a main surface).

### 3) Expanded the coach pilot preview into a multi-item preview
The coach pilot preview now supports a clearer **multi-item** preview (rather than a single isolated card), with state clarity improvements and debug data removed/hidden to keep the pilot surface clean.

### 4) Added and threaded the custom focus flow end-to-end
We added a **custom focus** option and ensured it threads through the Coach Share template experience:
- custom focus added into the template chooser
- template → preview now reflects the selected/custom focus reliably

### 5) Added template-selected reference link support (YT pill now supports IG too)
Coach Share templates now support a template-selected **reference link**. The current beta “YT pill” supports both:
- YouTube links
- Instagram links

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
- Coach Share pilot remains intentionally contained/hidden
- Coach Share pilot preview is cleaner (debug data hidden; clearer preview state)
- Custom focus is supported in Coach Share templates and preview
- Reference link pill supports YouTube + Instagram links
- Build 8 remains live in TestFlight

## Commits landed most recently
- `c2daab1` — Docs: update handoff for Coach Share pilot progress  
- `469ea58` — Feat: add custom focus option to Coach Share templates  
- `745059e` — Feat: expand Coach Share pilot preview with custom focus and IG links  
- `e9dec08` — Fix: clarify Coach Share preview state and hide debug data  
- `d195db7` — Feat: clarify Coach Share parent flow and coach pilot copy  

## Locked product / workflow decisions
- Terminal-first execution remains a hard project rule
- Build 8 remains live in TestFlight (beta reality)
- Feedback triage is intentionally tabled short-term
- Coach Share remains **hidden/pilot-scoped** (not a broad tester-facing feature yet)
- Coach Share pilot refinement (clarity + template/preview correctness) is currently the highest-ROI lane for Kyle internal testing

## Open loops
- Fix `expo lint` failure (`react/no-unescaped-entities`) in `app/(tabs)/profile/coaches/templates.tsx`
- Kyle internal testing: validate Coach Share parent-first hierarchy is intuitive
- Validate multi-item coach pilot preview readability and ordering
- Validate custom focus flow: template chooser → preview consistency
- Validate reference link handling across YouTube + Instagram links (formatting + tap behavior)
- Decide when to resume external Build 8 feedback triage (after Kyle pilot signal / once Coach Share pilot stabilizes)

## Best next-session recommendation
Next likely moves:
- fix the current lint failure, re-run gates (`npm run typecheck`, `npm run lint`)
- do a tight Coach Share pilot QA pass in Dev (parent route → coach pilot preview → custom focus → reference link pill)
- support Kyle internal testing by addressing only issues that block pilot usability/clarity
- keep Coach Share pilot hidden; avoid broad exposure work until pilot outcomes justify it
- resume Build 8 external feedback triage only when we’re ready to act on it

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`
- `sed -n '1,260p' "docs/recaps/2026-03-13_dev-recap.md"`

## Assumptions
- I treated Kyle internal Coach Share pilot usability as the highest-ROI signal for this lane.
- I assumed broader external Build 8 feedback triage could stay tabled until the Coach Share pilot flow was stable enough for internal use.
