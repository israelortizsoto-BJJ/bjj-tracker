# BJJ Tracker — Definition of Done

A feature is considered “Done” when:

## Engineering

- [ ] TypeScript passes (`npx tsc --noEmit`)
- [ ] No console warnings introduced
- [ ] AsyncStorage persists correctly
- [ ] Edge cases manually tested
- [ ] No visual layout breaks

---
## Change Validation (Required)

Every change must pass this loop before commit.

### 1) Build sanity (2 minutes)
- [ ] App boots
- [ ] Navigate: Profile → Training → Session Detail → back
- [ ] No red screen / runtime errors

### 2) Data persistence (2 minutes)
If you touched anything stored in AsyncStorage:
- [ ] Save the value
- [ ] Force close the app
- [ ] Reopen
- [ ] Confirm the value is still there

### 3) Regression check (3 minutes)
Test the 1–2 areas most likely to break from your change.
Examples:
- If you changed Training insights → verify all insight cards render
- If you changed Profile → verify Save works + fields don’t reset
- If you changed taxonomy → verify picker / pills still load

### 4) Type safety
- [ ] `npx tsc --noEmit` is clean

---

## Debug Protocol (When Something Breaks)

### A) Prove the file is loading
- [ ] Change visible UI text (e.g., title) and confirm it updates
Why: catches cache / wrong file / wrong route.

### B) Narrow scope
- [ ] Comment out half the block → does it still fail?
- [ ] Keep halving until you isolate the culprit

### C) Add one log
- [ ] Log the *inputs* into the logic (not the output)
Example: `console.log({ currentWeekCount, completedWeekStreak })`

### D) Fix → then remove logs
- [ ] No debug logs ship unless intentionally left as telemetry

---

## Code Cleanup (No Dead Weight)

### If you add code
- [ ] You can explain why it exists in 1 sentence

### If you stop using code
- [ ] Delete it (don’t comment it out)
- [ ] Confirm no references remain (search the symbol)

### Before commit
- [ ] `git diff` reviewed
- [ ] No accidental files changed
- [ ] No duplicate UI elements (example: double “Save Profile” button)
## UX

- [ ] Empty state considered
- [ ] Input validation handled
- [ ] Dark mode consistency maintained
- [ ] No hidden keyboard overlap

---

## Documentation

- [ ] dev-handoff.md updated
- [ ] architecture.md updated (if structural)
- [ ] decisions.md updated (if permanent choice)

---

## Psychological Check

- [ ] Feature does not feel rushed
- [ ] Scope creep avoided
- [ ] MVP intent preserved