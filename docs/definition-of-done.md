BJJ Tracker — Definition of Done

Purpose
This document defines the minimum quality bar for shipping changes in BJJ Tracker.
It exists to prevent regressions, type drift, data loss, and UI inconsistencies while preserving MVP velocity.

A feature is considered “Done” only when all sections below pass.

⸻

Engineering
	•	No console warnings introduced
	•	AsyncStorage persists correctly
	•	Edge cases manually tested
	•	No visual layout breaks

⸻

Change Validation (Required)

Every change must pass this loop before commit.

1) Build Sanity (2 minutes)
	•	App boots
	•	Navigate: Profile → Training → Session Detail → back
	•	No red screen / runtime errors

⸻

2) Data Persistence (2 minutes)

If you touched anything stored in AsyncStorage:
	•	Save the value
	•	Force close the app
	•	Reopen
	•	Confirm the value is still there

⸻

3) Regression Check (3 minutes)

Test the 1–2 areas most likely to break from your change.

Examples:
	•	If you changed Training insights → verify all insight cards render
	•	If you changed Profile → verify Save works + fields don’t reset
	•	If you changed taxonomy → verify picker / pills still load

⸻

4) Type Safety (Hard Gate)
	•	npx tsc --noEmit is clean
	•	npm run lint is clean
	•	No unused vars / dead types
	•	No duplicate type definitions (single source of truth)
	•	Storage keys imported only from src/storage/storageKeys.ts
	•	No hardcoded storage strings in screens
	•	Fundamentals types imported from src/fundamentals entry points (avoid unnecessary deep imports)
	•	If VS Code shows squiggles but tsc is clean → restart TS server before continuing

⸻

Debug Protocol (When Something Breaks)

A) Prove the file is loading
	•	Change visible UI text (e.g., title) and confirm it updates

Why: catches cache issues, wrong file, wrong route.

⸻

B) Narrow scope
	•	Comment out half the block → does it still fail?
	•	Keep halving until culprit is isolated

⸻

C) Add one log
	•	Log inputs into the logic (not outputs)

Example:
console.log({ currentWeekCount, completedWeekStreak })

⸻

D) Fix → then remove logs
	•	No debug logs ship unless intentionally left as telemetry

⸻

Code Cleanup (No Dead Weight)

If you add code
	•	You can explain why it exists in 1 sentence

If you stop using code
	•	Delete it (don’t comment it out)
	•	Confirm no references remain

⸻

Before Commit (Final Gate)
	•	Completed Change Validation → Type Safety
	•	git diff reviewed
	•	No accidental files changed
	•	No duplicate UI elements
	•	App launches after latest changes

⸻

UX
	•	Empty state considered
	•	Input validation handled
	•	Visual theme consistency maintained
	•	No hidden keyboard overlap

⸻

Documentation
	•	dev-handoff.md updated
	•	architecture.md updated (if structural)
	•	decisions.md updated (if permanent choice)

⸻

Psychological Check
	•	Feature does not feel rushed
	•	Scope creep avoided
	•	MVP intent preserved

⸻

Anti-Patterns (Do Not Do)
	•	❌ Adding abstractions “just in case”
	•	❌ Creating new folders without documenting them in architecture.md
	•	❌ Hardcoding storage keys or magic strings in screens
	•	❌ Duplicating types instead of importing from source of truth
	•	❌ Shipping commented-out code
	•	❌ Silencing TypeScript or ESLint instead of fixing root cause
	•	❌ Large commits that mix unrelated changes
	•	❌ UI changes without validating empty states
	•	❌ Refactors without behavior change explanation