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
Use `href: null` for dormant routes and Coach Share subroutes.
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
**Date:** 2026-03-11  
**Status:** Coach Share moved from scaffold-only into a real parent flow plus a believable coach template-selection demo path; all changes committed and pushed

## Git checkpoint

**Working tree:**
- synced to `origin/dev`
- only local untracked folder: `.cursor/`

**Latest commit:**
- `d9fa4d9` — Feat: add Coach Share template selection handoff

## What we completed this block

### 1) Parent-facing Coach Share became real

We turned the existing Coach Share scaffold into a parent-readable dashboard with:
- linked coach
- current assignment
- module focus
- program pack context
- clean empty state
- working scroll behavior

Then we extended the parent loop so the parent can:
- mark an assignment complete
- persist that completion locally
- see a Recent Completion acknowledgment after reload

### 2) Coach-side authoring direction got a believable front door

We added:
- Create Program Pack entry
- Use Template / Customize Existing Template / Start From Scratch choices
- a hidden Program Pack Templates screen
- realistic BJJ demo template packs:
  - Guard Pull Defense — Knee in the Middle
  - Triangle Defense — Posture and Escape
  - Half Guard Passing — Heavy Chest and Table Hands

### 3) Template path now feels like a real workflow

We upgraded the coach-side template path so it no longer ends on an alert:
- browse templates
- preview selected template
- continue into a selected-template handoff screen
- understand that customization/assignment flows come next

## What passed

### Gates
- `npx tsc --noEmit` — passed repeatedly across slices
- `npx eslint .` — passed repeatedly across slices

### App validation
Validated in app at each slice:
- parent dashboard
- completion flow
- completion summary
- pack creation entry
- template selection
- template preview
- template-selected handoff
- back navigation between key coach-side screens

## Locked product decisions

### Coach Share Phase 1 remains narrow
- no messaging
- no kid login
- parent-controlled flow
- local-first state
- no full coach editor yet

### Coach authoring direction
Coach will eventually have 3 paths:
1. use template
2. duplicate/customize template
3. start from scratch

### Template rule
Templates should remain canonical/read-only.
Coach customization should happen on copies later.

## Locked workflow decisions

### Cursor operating rule
Use a new Cursor chat for every new feature/task.

### Validation rule
Do not trust Cursor output on sight.
Truth requires:
1. scoped diff
2. terminal gates
3. app validation
4. intentional commit

### Cursor migration judgment
Cursor performed well today on tightly scoped, supervised feature slices.
It is approved for continued controlled use on:
- local UI improvements
- contained product slices
- hidden-route scaffolds
- 1–3 file tasks

Cursor is still not approved for:
- broad refactors
- storage/model migrations
- release-critical config work
- unsupervised cross-file cleanup

## Commits completed in this block
- `be3d3cb` — Feat: make Coach Share dashboard parent-readable
- `b55f27f` — Feat: add Coach Share completion flow
- `4d98d8f` — Feat: add Coach Share completion summary
- `18c2076` — Feat: add Coach Share pack creation entry scaffold
- `d21d457` — Feat: add Coach Share template selection scaffold
- `825468c` — Feat: add Coach Share template preview flow
- `d9fa4d9` — Feat: add Coach Share template selection handoff

## Best next-session recommendation

Best next move:
Build the smallest **customize-from-template scaffold** after template selection handoff.

Likely shape:
- selected template shown
- editable pack title only
- read-only module list
- note that module editing/assignment comes later

Do not jump into full builder logic yet.

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`

## Assumptions
- I assumed today’s meaningful work should replace the previous Coach Share section in the living handoff rather than append duplicate notes.
- I assumed `.cursor/` should remain local and untracked for now.
