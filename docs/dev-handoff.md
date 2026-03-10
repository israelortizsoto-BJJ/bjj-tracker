# BJJ Tracker — Developer Handoff

Last Updated: 2026-02-24
Branch: dev  
Repo: israelortizsoto-BJJ/bjj-tracker  

---
### “Stable Checkpoint”
### 2026-02-24

- Block 2 (Domain Metrics Extraction) completed:
  - Created canonical metrics module: app/domain/metrics.ts
  - Training tab now calls domain metrics instead of inline computations

- Extracted metrics (domain-owned):
  - Top System (This Week)
  - Top Technique (This Week)
  - Current Focus (14d)
  - Gi vs No-Gi (14d)
  - Week count helpers
  - Completed week streak
  - Last week total (for weekly delta)

- Cleanup:
  - Removed unused local helpers from Training tab (pickTopKey, TopKeyCount)
  - TypeScript + ESLint clean (gated before commit)

### 2026-02-23

- Storage contract stabilized:
  - app/storage/storageKeys.ts
  - app/storage/migrations/index.ts
- Versioned migration flow in place (v2)
- Legacy rescue for sessions + profile
- Migrations executed on app boot via app/_layout.tsx

- Technique index contract stabilized:
  - Canonical type: app/fundamentals/types.ts
  - Re-exported from app/fundamentals/index.ts
  - TechniqueIndexItem.path is object (not string)

- Insight cards aligned to ID-based contract:
  - Top System → systemId + resolver
  - Current Focus (14d) → systemId + resolver
  - Top Technique pluralization polish

- TypeScript + ESLint clean

## Quick Check (Run before you commit)
Tip: avoid pasting `git diff` into chat—use `git diff > /tmp/diff.txt` and `tail -n 80 /tmp/diff.txt`.

- [ ] App boots (no red screen)
- [ ] Navigate: Profile → Training → Session Detail → back
- [ ] Do the change manually in UI (the thing you actually edited)
- [ ] If AsyncStorage touched: Save → force close → reopen → confirm persisted
- [ ] `npx tsc --noEmit` (clean)
- [ ] `git diff` (no surprise changes / no debug logs)
- [ ] Search for duplicates / dead code (delete, don’t comment out)
- [ ] Preferred proof command:
      `git rev-parse --short HEAD && git show -s --format=%s HEAD && npx tsc --noEmit && npm run lint && echo "✅ TS + Lint PASS"`
- [ ] Use bjjproof/bp for safe proof + commit workflow (diff saved to /tmp/diff.txt; review tail)
- [ ] Commit message matches what changed (1 sentence truth)

## Current Focus (Next 1–3 tasks)

1) Profile: finalize keyboard behavior + validation (only if it blocks MVP)
2) Insights: add first "Consistency Trend" card (keep domain-first approach)
3) Docs: add Quick Check reinforcement + new terminal commands (bjj / bjjproof / bp)

## 🚧 Open Questions / Decisions Pending (Active)

- How should weight be used later? (insights vs profile-only)
- When to introduce Coach Share / Coach Mode?
- Do we support multiple academies in future?

(Full list at bottom)
One-line goal  
Mobile app for logging BJJ training sessions, techniques, and progress with structured taxonomy.

Target users  
Hobbyists • Competitors • Kids + Parents • Coaches

MVP success metric  
Users open the app weekly without being reminded.

---
## Product Snapshot
## Tech Stack

- Expo (React Native)
- TypeScript
- Expo Router
- AsyncStorage

---

## Mental Model — Training Tab

6-Block Structure:

1. Imports & Types  
2. Pure Helpers  
3. Component Setup  
4. Data Loading  
5. Derived Data  
6. Render  

Rule: Logic lives in Blocks 2–5. Render is dumb.

---

## Data Model

Storage key (canonical): StorageKeys.sessions (see app/storage/storageKeys.ts)
Legacy keys (rescued via migration): bjj.sessions.v1, bjj_sessions_v1

Session fields:
- techniqueId (primary structured ID)
- technique (legacy fallback string)
- system (taxonomy id)
- gear
- position / grips / finish
- notes
- youtubeUrl
- imageUri / videoUri

Legacy fields remain intentionally (no migration yet).

---

## Weekly Goal Streak

WEEKLY_GOAL = 3

- Completed prior weeks count.
- Current week adds +1 once threshold is hit.
- Designed for immediate motivation.

---

## Profile Tab Additions (2026-02-20)

- TRAIN. REFLECT. IMPROVE.
- Belt glow ring (accent by belt)
- Last promotion date
- Weight input
- KeyboardAwareScrollView implemented

Do not mix ScrollView and KeyboardAwareScrollView.

---

## Known Constraints
 Metrics may surface systemId "ALL" if legacy sessions stored that value; behavior unchanged for MVP.

- Expo AV deprecated warning
- Media limited in Expo Go
- No migration plan yet

Intentional for MVP.

---
## Dev Commands (Local)

- Start Expo (cache clear):
  - `bjj`

- Proof + commit workflow (gates → diff tail → stage → commit → push → log):
  - `bjjproof "commit message"`
  - `bp "commit message"` (alias)

---
## Restart Checklist

1. npm install
2. npx tsc --noEmit
3. Open Training tab
4. Add session
5. Confirm streak updates
6. Confirm insights render
7. Confirm profile saves

---

## Session Delta Log

### 2026-02-20
- Fixed weekly streak logic
- Added profile onboarding + belt glow + weight
- Added DLR taxonomy

## Open Questions / Decisions Pending

- 

---

## End-of-day recap prompt

Use this prompt at the end of each BJJ Tracker workday:

Action: End-of-day BJJ Tracker recap. Think hard. Update BJJ Tracker using the living-files vs dated-files rule.

Context
- Project: BJJ Tracker / MatMind Jiu Jitsu
- Branch: dev
- Repo: bjj-tracker
- Date: YYYY-MM-DD
- Timezone: America/Los_Angeles

Inputs I will paste
1) Git proof:
- git status -sb
- git log -5

2) What I worked on today:
- [ ] …
- [ ] …
- [ ] …

3) Testing / QA / release updates:
- [ ] …
- [ ] …

4) Key product / UX / technical decisions:
- [ ] …
- [ ] …

5) Open loops / bugs / risks:
- [ ] …
- [ ] …

Request
- First, tell me what should update the living files vs what should be captured as dated record.
- Then give me exact terminal blocks to:
  - update docs/dev-handoff.md if current truth changed
  - create or update docs/recaps/YYYY-MM-DD_dev-recap.md
- If relevant, also update:
  - docs/decisions.md
  - docs/definition-of-done.md
- Keep the system clean. Do not create extra files unless the work exposed a real gap.
- End by telling me the top 1–3 priorities for the next dev session.

---

## Current release truth — 2026-03-09
- Build 6 completed App Store Connect processing on 2026-03-09
- Internal 20-minute stress test passed for core release goals
- Main release focus passed: Training flow clarity and lower-friction session logging
- Profile promotion date validation and save flow passed
- Known issue: some older previously attached camera-roll videos did not persist correctly, while newly attached video in current build worked and persisted after hard close
- Build number 5 was skipped during release-flow correction
- Build 6 became the first correctly versioned production/TestFlight upload under the fixed release flow
- Next move: release Build 6 to external testers and collect focused usage feedback
