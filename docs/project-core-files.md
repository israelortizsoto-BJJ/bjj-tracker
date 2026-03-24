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
- app/role-picker.tsx

## Core App Surfaces
- app/(tabs)/welcome.tsx
- app/(tabs)/profile.tsx
- app/(tabs)/training.tsx
- app/(tabs)/training/[id].tsx
- app/(tabs)/Fundamentals.tsx
- app/(tabs)/gear.tsx

## Coach Share current lane
- app/(tabs)/profile/coaches/index.tsx
- app/(tabs)/profile/coaches/_layout.tsx
- app/(tabs)/profile/coaches/join.tsx
- app/(tabs)/profile/coaches/manage.tsx
- app/(tabs)/profile/coaches/create-pack.tsx
- app/(tabs)/profile/coaches/parent-athletes.tsx
- app/(tabs)/profile/coaches/templates.tsx
- app/(tabs)/profile/coaches/template-preview.tsx
- app/(tabs)/profile/coaches/template-selected.tsx

## Device role split (Coach/Parent)
- src/storage/deviceRoleStore.ts
- src/deviceRole/DeviceRoleProvider.tsx
- src/deviceRole/coachRouteGate.ts

## Family Competition (parent-facing lane on Coach Share weekly surface)
- app/(tabs)/profile/coaches/family-competition/edit.tsx
- src/family/coachShareCompetitionBuckets.ts
- (routing) app/(tabs)/_layout.tsx — hidden tab screen for `family-competition/edit`

## Coach weekly sync — two-device worker-backed session
These files implement invite/redeem session flow, coach publish of weekly payload, and parent read/shared-athlete linkage via Cloudflare Worker + local cache. Current scope includes **weekly note + shared athletes**. Parent-entered **competition/training** data still behaves as local-only and does not sync back to coach yet.
- coach-sync-worker/ (Wrangler: `wrangler.toml`, `src/index.ts`, `package.json`)
- src/config/coachSync.ts
- src/types/coachWeeklySync.ts
- src/services/coachWeeklySyncApi.ts
- src/storage/coachWeeklySyncCacheStore.ts
- src/coach/weeklyFocusPublish.ts
- app.config.ts — `extra.coachSyncBaseUrl` / env wiring for `EXPO_PUBLIC_COACH_SYNC_BASE_URL`

## Coach kid pilot (internal, Profile → Coach Share → Kids)
- app/(tabs)/profile/coaches/kids.tsx
- app/(tabs)/profile/coaches/kid/[kidId].tsx
- app/(tabs)/profile/coaches/kid/[kidId]/what-matters-next.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/weekly-focus.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/history.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/progress-reflection.tsx
- app/(tabs)/profile/coaches/kid/[kidId]/competition/edit.tsx
- src/storage/coachKidStore.ts (roster + **household** fields / grouping helpers as implemented)
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
