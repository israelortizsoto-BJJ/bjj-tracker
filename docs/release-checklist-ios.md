# MatMind iOS Release Checklist

## Purpose
Use this checklist before submitting a production iOS build for MatMind Jiu Jitsu to Apple / TestFlight.

## Release lane rule
- Production/TestFlight app = MatMind Jiu Jitsu
- Production bundle id = com.ortizdigitalstudio.matmind
- Dev/internal app = MatMind Dev
- Dev bundle id = com.ortizdigitalstudio.matmind.dev
- Never submit the dev app to Apple/TestFlight

## Black Belt / coach feedback build (TestFlight)
Use this lane for **repeatable internal feedback** builds where **Coach Share must appear on Profile** (same production bundle ID as store/TestFlight; not the `.dev` app).

### How this differs from production store builds
- **`production` EAS profile:** App Store/TestFlight artifact with default env — **Coach Share Profile entry stays off** for broad releases unless product changes that contract.
- **`testflight-internal` EAS profile:** Same `com.ortizdigitalstudio.matmind` app; build env sets `SHOW_COACH_SHARE_PROFILE_ENTRY=1` and `EXPO_PUBLIC_SHOW_COACH_SHARE_PROFILE_ENTRY=1` so the entry is **reliably visible** (see `app.config.ts` and `src/config/runtime.ts`).

### Preflight (feedback lane)
- Confirm intentional git state (`git status -sb`, `git log -5`)
- Run quality gates: `npm run typecheck` and `npm run lint`
- Sanity-check prod identity (no dev bundle): `npx expo config --type public` → `ios.bundleIdentifier` must be `com.ortizdigitalstudio.matmind`, `extra.appVariant` must be `prod`
- Confirm `eas.json` → `build.testflight-internal.env` still includes both Coach Share flags (do not rely on remembering to export them locally)

### Build (feedback)
```bash
npm run build:ios:feedback
```
Equivalent: `npx eas-cli build --platform ios --profile testflight-internal`

Wait for the build to finish; note build ID / URL if tracking releases.

### Submit (feedback)
Submit uses the **same** App Store Connect app and `submit.production` credentials as production uploads (only the **build profile** differed).

```bash
npm run submit:ios:feedback
```
Equivalent: `npx eas-cli submit --platform ios --profile production --latest`

If submit fails, use the same **Fallback path** as in [Submit path](#submit-path) (download `.ipa`, Transporter).

### App Store Connect — audience (required)
After the build processes in TestFlight:
- Assign testers **deliberately** (Internal Testing and/or a **Black Belts–only** External group). Do not widen distribution by habit.
- **Rule:** treat coach-feedback builds as **Black Belts / internal-pilot only** until product explicitly expands the audience.

## Data preservation reminder

When validating TestFlight builds on devices:
- **Upgrade Existing App** — do not delete the app, reset storage, remove athletes, or clear competitions
- Historical on-device state is valuable forensic evidence during beta validation

## Documentation audit reminder (before release)

Before submitting any production or feedback TestFlight build:
- confirm `docs/dev-handoff.md` reflects what this build actually validates vs what remains Dev-only
- run `python3 tools/docs_ops/audit_docs.py` and `python3 tools/docs_ops/compare_docs.py` if canonical docs changed this cycle
- ensure release notes / recap updates are queued per **Release notes / tracking** below

## Preflight
- Confirm repo is in an intentional state
- Run:
  - git status -sb
  - git log -5
- Decide whether any uncommitted changes should be committed before release prep

## Production config verification
Run:
- npx expo config --type public

Confirm:
- name = MatMind Jiu Jitsu
- ios.bundleIdentifier = com.ortizdigitalstudio.matmind
- extra.appVariant = prod

If any of those are wrong, stop and fix config before building.

## Versioning rules
- appVersionSource must remain remote in eas.json
- production build profile must include autoIncrement: true
- submit.production profile must exist in eas.json
- Remote iOS build number must be aligned to the last delivered production/TestFlight build

## If remote iOS build number needs correction
Run:
- npx eas-cli build:version:set

Then:
- choose iOS
- set the next correct build number

## Quality checks before build
Run:
- npm run lint
- npm run typecheck

If these fail, stop and fix before release build.

## Production build
Run:
- npx eas-cli build --platform ios --profile production

Wait for build to finish and capture:
- build ID
- build URL
- artifact link

## Submit path
### Preferred path
Run:
- npx eas-cli submit --platform ios --profile production

Use:
- production app only
- existing Apple credentials if valid
- EAS-managed flow if already established

### Fallback path
If EAS submit fails:
- download the .ipa from the EAS build artifact
- open Transporter
- add the downloaded .ipa manually

## Transporter verification rule
Before clicking Deliver in Transporter, verify:
- app is MatMind Jiu Jitsu
- version is correct
- build number is correct and higher than the last delivered production/TestFlight build

If build number is wrong, do not deliver. Fix versioning, rebuild, and upload the corrected .ipa.

## After upload
Go to:
- App Store Connect
- MatMind Jiu Jitsu
- TestFlight

Confirm:
- new build appears
- build is processing
- build becomes available for testing

## Release notes / tracking
After release prep:
- update docs/dev-handoff.md if current truth changed
- create or update docs/recaps/YYYY-MM-DD_dev-recap.md
- update external Google Sheet tracker separately if needed

## Commit release-process changes
If release setup files changed, commit them after the build/upload path is correct.

Example:
- git add eas.json docs/release-checklist-ios.md
- git commit -m "Docs: add iOS release checklist and release flow fixes"

## Standard
Do not rely on memory for production releases. Follow the checklist, verify production config, verify build number, then submit.
