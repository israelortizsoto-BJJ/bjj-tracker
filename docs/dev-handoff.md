# BJJ Tracker — Developer Handoff

Last Updated: 2026-02-22  
Branch: dev  
Repo: israelortizsoto-BJJ/bjj-tracker  

---
## Quick Check (Run before you commit)

- [ ] App boots (no red screen)
- [ ] Navigate: Profile → Training → Session Detail → back
- [ ] Do the change manually in UI (the thing you actually edited)
- [ ] If AsyncStorage touched: Save → force close → reopen → confirm persisted
- [ ] `npx tsc --noEmit` (clean)
- [ ] `git diff` (no surprise changes / no debug logs)
- [ ] Search for duplicates / dead code (delete, don’t comment out)
- [ ] Commit message matches what changed (1 sentence truth)

## Current Focus (Next 1–3 tasks)

1) Profile: finalize keyboard behavior + validation
2) Training: image/video pills in Week & Yesterday
3) Insights: first "Consistency Trend" card


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

Storage key: bjj.sessions.v1

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

- Expo AV deprecated warning
- Media limited in Expo Go
- No migration plan yet

Intentional for MVP.

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