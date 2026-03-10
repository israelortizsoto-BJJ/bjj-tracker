# MatMind iOS Release Checklist

## Purpose
Use this checklist before submitting a production iOS build for MatMind Jiu Jitsu to Apple / TestFlight.

## Release lane rule
- Production/TestFlight app = MatMind Jiu Jitsu
- Production bundle id = com.ortizdigitalstudio.matmind
- Dev/internal app = MatMind Dev
- Dev bundle id = com.ortizdigitalstudio.matmind.dev
- Never submit the dev app to Apple/TestFlight

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

## Tester focus for Build 5
- Training flow clarity
- Add session placement near calendar
- Today / Yesterday / This Week filter clarity
- Session logging flow
- Cancel session flow
- Profile promotion date guidance
- Any confusion around prior-date review behavior

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
