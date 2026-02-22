# BJJ Tracker — Developer Handoff

Last Updated: 2026-02-22  
Branch: dev  
Repo: israelortizsoto-BJJ/bjj-tracker  

---

## Product Snapshot

One-line goal  
Mobile app for logging BJJ training sessions, techniques, and progress with structured taxonomy.

Target users  
Hobbyists • Competitors • Kids + Parents • Coaches

MVP success metric  
Users open the app weekly without being reminded.

---

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