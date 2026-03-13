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
**Date:** 2026-03-12  
**Status:** Build 7 now feels like a real multi-surface dev app. Tab flow, light theme surfaces, Training QA fixes, and Coach Share polish were completed and pushed.

## Git checkpoint

**Working tree:**
- synced to `origin/dev`

**Latest commit:**
- `8936408` — Feat: polish Build 7 tab flow and light theme surfaces

## What we completed today

### 1) Rebuilt and completed the Build 7 QA pass
We ran a real app-wide QA pass across:
- Welcome
- Profile
- Training
- Fundamentals
- Gear
- Coach Share
- Add New Session
- hidden Coach Share subflows

Key judgment:
Build 7 now feels meaningfully more complete without losing focus.

### 2) Fixed real Training UX issues
We fixed:
- Training search so broader system/category terms like system labels match correctly
- technique-row destructive action clutter in the session editor
- additional row action clarity and visual consistency

Training now supports:
- multi-technique sessions
- system-label search
- cleaner technique editing

### 3) Fixed Coach Share usability gaps
We fixed:
- missing back navigation from Create Program Pack
- visual mismatch between Coach Share and the newer Build 7 light surfaces

Coach Share now:
- visually belongs to the same app
- has cleaner navigation
- remains a pilot lane accessible from Profile

### 4) Exposed Build 7 tabs intentionally in dev
In the dev app only, the visible tab order is now:
1. Welcome
2. Profile
3. Training
4. Fundamentals
5. Gear

Production/TestFlight behavior remains unchanged.

### 5) Unified the light Build 7 visual system
Profile, Training, Add New Session, and Coach Share surfaces were brought into the same lighter visual language already seen in Welcome, Fundamentals, and Gear.

This included:
- lighter backgrounds
- white cards
- consistent borders
- stronger blue accent usage
- centered button text where needed
- better cross-screen visual cohesion

## What passed

### Gates
- `npx tsc --noEmit` passed throughout final fixes
- `npx eslint .` passed throughout final fixes

### App validation
Validated:
- visible dev tab order
- no extra/truncated tab leakage
- Profile save still routes to Training intentionally
- Training search works for system labels
- Add Session button text centering
- Save Profile button text centering
- Add New Session visual/readability pass
- Coach Share home, Join, Manage, Create Program Pack, Templates, Preview, and Selected screens all visually/readability pass

## Commits landed today
- `552018e` — Fix: include system labels in Training search
- `20d8145` — Fix: unify technique row actions in Training editor
- `61093d4` — Fix: add Coach Share back navigation from pack creation
- `8936408` — Feat: polish Build 7 tab flow and light theme surfaces

## Locked product decisions
- Build 7 should feel meaningfully more complete, not broadly overbuilt
- Welcome, Profile, Training, Fundamentals, and Gear are the right visible dev QA tabs
- Coach Share remains reachable from Profile, not as a main tab
- Dev Shortcuts stay for now
- The global launch behavior that routes returning users toward Training is intentional

## Best next-session recommendation
Next likely moves:
- decide whether Build 7 is ready for an internal release-readiness pass
- update release/tester focus if Build 7 is the next candidate
- continue Coach Share pilot readiness for Kyle without broadening scope
- consider a short release checklist pass instead of more feature work

## Suggested restart commands for next session
- `git status -sb`
- `git log -5 --oneline`
- `sed -n '1,260p' "docs/dev-handoff.md"`

## Assumptions
- I treated today’s work as the new current truth for Build 7 and replaced older partial guidance.
- I assumed the dev tab exposure remains dev-only and should not be generalized to production yet.
