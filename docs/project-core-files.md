# MatMind / BJJ Tracker — Core Files

## Purpose
These are the primary files and docs to use when reacquiring project truth.
Use this list before relying on memory, stale summaries, or scattered notes.

## Core runtime / release config
- package.json
- app.json
- app.config.ts
- eas.json
- tsconfig.json
- eslint.config.js

## Core app shell
- app/index.tsx
- app/_layout.tsx
- app/(tabs)/_layout.tsx

## Core App Surfaces
- app/(tabs)/welcome.tsx
- app/(tabs)/profile.tsx
- app/(tabs)/training.tsx
- app/(tabs)/training/[id].tsx
- app/(tabs)/Fundamentals.tsx
- app/(tabs)/gear.tsx

## Coach Share current lane
- app/(tabs)/profile/coaches/index.tsx
- app/(tabs)/profile/coaches/join.tsx
- app/(tabs)/profile/coaches/manage.tsx
- app/(tabs)/profile/coaches/create-pack.tsx
- app/(tabs)/profile/coaches/templates.tsx
- app/(tabs)/profile/coaches/template-preview.tsx
- app/(tabs)/profile/coaches/template-selected.tsx

## Coach kid pilot (internal, Profile → Coach Share → Kids)
- app/(tabs)/profile/coaches/kids.tsx
- app/(tabs)/profile/coaches/kid/[kidId].tsx
- app/(tabs)/profile/coaches/kid/[kidId]/what-matters-next.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/weekly-focus.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/history.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/progress-reflection.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/competition/edit.tsx
- src/storage/coachKidStore.ts
- src/storage/kidStandingGuidanceStore.ts
- src/storage/kidCompetitionStore.ts
- src/storage/sessionsStore.ts
- src/types/coachKid.ts

## AI drafting — Slice 1 (mock / on-device, `what-matters-next`)
- src/ai-coach/whatMattersNextDraftTypes.ts
- src/ai-coach/loadWhatMattersNextDraftPayload.ts
- src/ai-coach/whatMattersNextDraftGenerator.ts

## Runtime / flags / storage
- src/config/runtime.ts
- src/config/flags.ts
- src/config/devFlagsStore.ts
- src/config/useDevFlags.ts
- src/storage/storageKeys.ts
- src/storage/migrations/index.ts
- src/storage/coachShareStore.ts

## Product/domain files
- src/fundamentals/index.ts
- src/fundamentals/taxonomy.ts
- src/domain/metrics.ts
- src/types.ts
- src/types/coachShare.ts

## Core docs
- docs/dev-handoff.md
- docs/decisions.md
- docs/definition-of-done.md
- docs/release-checklist-ios.md
- docs/builds/build-7-scope.md
- docs/qa/build-7-release-readiness-pass-2026-03-13.md

Note: build-specific docs here are structural reference points; treat the current coach-testing build as the active learning lane.

## Rule
When project context feels stale:
1. check git status -sb
2. check git log -5 --oneline
3. read these files before making workflow or release assumptions
