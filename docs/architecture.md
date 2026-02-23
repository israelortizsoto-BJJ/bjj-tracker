# BJJ Tracker — Architecture

Last Updated: 2026-02-22  
Branch: dev

---

## 1. Architectural Principles

- File-based routing (Expo Router)
- Feature-first organization inside tabs
- Local-first persistence (AsyncStorage)
- Minimal abstraction until needed

Why:
Defines the philosophy of how this app is built so future changes stay consistent.

---

## 2. High-Level App Structure

app/
- (tabs)/
  - training/
  - profile.tsx
  - fundamentals/
- components/
- constants/
- hooks/
- assets/

Why:
Gives a fast mental map of where things live.

---

## 3. Navigation Model

- Expo Router
- Tabs defined in `app/(tabs)/_layout.tsx`
- Each tab owns its own UI + logic

Why:
Prevents hunting for navigation logic.

---

## 4. Data Persistence Strategy

Current:
- AsyncStorage

Primary Keys:
- `bjj_profile_v1`
- `training_sessions_v1`

Why:
Documents storage contracts so data changes don’t break users.

---

## 5. Training Tab Architecture

Mental Model:
6-Block Structure

1. Imports & Types  
2. Pure Helpers  
3. Component Setup  
4. Data Loading  
5. Derived Data  
6. Render  

Why:
This is the core pattern used across large screens.

---

## 6. Profile Tab Architecture

Responsibilities:
- Belt
- Stripes
- Academy
- Coach
- Weight
- Promotion Date

Rules:
- Local state
- Persist via AsyncStorage
- No cross-tab side effects

Why:
Keeps Profile simple and predictable.

---

## 7. Taxonomy System

Location:
`app/fundamentals/taxonomy.ts`

Contains:
- Guards
- Positions
- Submissions
- Variations

Why:
This file represents core domain knowledge (IP).

---

## 8. Media Handling

- Images: Camera Roll
- Video: MediaLibrary resolve
- Playback: Inline modal

Constraints:
- Expo Go limitations

Why:
Media is fragile — documenting avoids regressions.

---

## 9. Styling System

- Screen-level inline styles
- Shared tokens in `constants/themes.ts`

Why:
Prevents random styling patterns.

---

## 10. Known Tradeoffs

- No backend
- No auth
- No cloud sync
- Local-only MVP

Why:
Makes omissions intentional.

---
## Architecture Decisions Pending
- 
## 11. Planned Evolution (Not Commitments)

- Backend (Supabase or Firebase)
- Cloud sync
- Coach Mode
- Multi-device

Why:
Captures direction without locking design.

---