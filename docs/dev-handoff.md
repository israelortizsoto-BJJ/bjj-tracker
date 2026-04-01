# BJJ Tracker —
Action: think-hard look through this Developer Handoff notes, plan out the day. If you are making assumptions, tell me when you are doing so. Let's get to work

## Non-negotiable: Dev/TestFlight coexistence.
Keep two separate bundle IDs forever:
- Prod/TestFlight: `com.ortizdigitalstudio.matmind`
- Dev: `com.ortizdigitalstudio.matmind.dev`

Never overwrite the TestFlight app with dev installs again.
Keep Xcode target stable across variants.
Do not change Expo name per variant (can break Xcode targets / EAS).
Use `ios.infoPlist.CFBundleDisplayName` for the Dev icon label (“MatMind Dev”).

## TestFlight is “beta reality.”
Nothing affects testers until we ship a new TestFlight build.
Validate bugs in TestFlight whenever possible, not only in Dev.

## Feature flags stay (but “code flags,” not build CLI flags).
Keep dev-only flags persisted locally (AsyncStorage) and guarded by `isDev()`.
Flags live under `src/config/*` and are toggled in Dev Settings.
Do not rely on EAS/Expo prebuild CLI flags for product behavior.

## Dev tooling lives in Dev Settings, not onboarding flows.
Avoid putting dev-only navigation inside Welcome/onboarding screens (redirect logic causes loops).
Use Dev Settings “Dev Shortcuts” to reach hidden routes.

## Hidden routes stay hidden from the tab bar by default unless intentionally exposed in dev.
Use `href: null` for internal routes and nested **This Week** / **Learn** stack screens so join flows, kid drill-downs, and legacy tab filenames do not leak as extra tabs.
In Dev, the weekly coach/parent lane is the **This Week** tab (`app/(tabs)/this-week/**`); Profile remains the home for account/settings and dev shortcuts. Black Belt / coach feedback builds still use `docs/release-checklist-ios.md` (prod bundle, Coach Share visibility rules there).
Tester-facing tab exposure in Dev is intentionally simplified to four tabs:
- This Week
- Training
- Learn
- Profile

Welcome remains available as a hidden/onboarding route, not a permanent tab.

## Terminal-first workflow is the default.
Prefer terminal-driven, repeatable edits and commands wherever practical.

**Black Belt / coach feedback TestFlight lane** (Coach Share visible, same prod bundle ID): `npm run build:ios:feedback` → then `npm run submit:ios:feedback`. Full preflight, ASC audience rules, and prod vs feedback distinction: `docs/release-checklist-ios.md` (section *Black Belt / coach feedback build*).
Minimize manual editor changes.
If a task is not easy to do from terminal, treat that as a workflow gap to fix rather than a reason to default to hand-editing.
Use Cursor in a supervised workflow with terminal-visible commands, scoped diffs, gates, and intentional commits.

## No ad-hoc patching as a default workflow.
Avoid brittle regex/sed/perl “injection” edits for features.
Prefer clean, intentional file edits + TS/ESLint gates + clear commits.
Only use patching as emergency repair, not normal iteration.

## Gates are the source of truth (not Cursor summaries).
Always run:
- `npx tsc --noEmit`
- `npx eslint .`

before pushing meaningful app changes.

## Avoid reintroducing router landmines.
Screen names must be unique in `app/(tabs)/_layout.tsx`.
Do not let hidden/internal routes leak into the visible tab bar.

## Operational note to keep running:
When connecting Dev Client:
- Mac + iPhone on same hotspot/Wi-Fi
- macOS Firewall off or allow Metro/Node

Keep a dedicated build terminal untouched while EAS runs; use a separate tab for edits.

---

# BJJ Tracker — Developer Handoff Notes

**Project:** BJJ Tracker / MatMind Jiu Jitsu  
**Branch:** `dev`  
**Repo:** `israelortizsoto-BJJ/bjj-tracker`  
**Date:** 2026-04-01  
**Status:** **Build 21 bridge QA is complete** in Dev: multi-kid **invite truth** is confirmed end-to-end for parent and coach, and the **shared Family Huddle** model is confirmed as **invite-scoped** with **last publish wins** (still a **known product limitation** until Option B). A **critical training bleed bug** is **fixed**—coach-logged kid training sessions **no longer incorrectly surface on the parent side**. **Competition video** support is **shipped coach-side only**: up to **three** videos per competition entry. **Family Huddle** remains **invite-scoped**, not per-athlete. The **build is ready for the release flow** (cut Build 21 → internal testers / coaches); **TestFlight / external tester truth** updates only after upload and verification as documented here.

**2026-04-01 (latest):** Final **Build 21 bridge QA pass** closed: multi-kid invite truth across parent and coach verified; shared **Family Huddle** behavior (invite-scoped, last publish wins) explicitly confirmed. **Training bleed fix:** sessions logged by the coach for a linked kid no longer appear on the parent training surface. **Competition:** coach-side entries support up to **three** competition videos per entry (parent-side competition video archive **not** in this build). Release posture: **ready to cut Build 21** and ship to internal testers/coaches.

**2026-03-31:** Multi-kid truth alignment: parent **This Week** now uses **truly linked kids** for the active invite in Dev; coach roster visibility was improved so invite-linked multi-kid truth reads more accurately; parents can open **Athletes on this invite** from the manage-coach link screen; parent and coach views agree more clearly on **invite-linked** kids. Household save-state on coach kid detail: save is **disabled when not dirty**, shows a clear **Saved** state after success, and redundant helper text was removed. **Session persistence Phase 1:** a real raw-session boundary (`getSessions`, `setSessions`, `deleteSessionsForKid`) now backs `app/(tabs)/training/[id].tsx` and `src/storage/coachKidStore.ts`—no storage schema migration. **Shared-vs-child UI honesty:** Family Huddle / weekly note wording was updated for clarity only (shared-per-invite reality).

**2026-03-27:** A narrow **release-shaping** cleanup landed for the next feedback build: **This Week** / **Learn** shells were tightened after two-device QA; duplicate top headers were fixed by letting nested stack headers own those tabs; coach **This Week** root (`/this-week`) is now a short coach landing with a CTA into Kids roster, while the parent root keeps the family-facing weekly experience (coach root no longer shows parent-facing Family Huddle, parent competition shell, parent link-refresh shell, or root weekly-focus preview). Visible internal/dev exposure for feedback logic was reduced; **Profile** internal controls remain intentionally available in dev/internal contexts. This was **not** a sync expansion or architecture refactor—worker-backed weekly scope and the parent-entered training/competition boundary are unchanged. **TestFlight remains older shipped reality** until a new build is uploaded and documented here—nothing below is claimed as external-tester truth yet.

**2026-03-30:** Build 20 QA cleanup + verification landed in Dev with three core outcomes: (1) parent training save flow now returns directly to **This Week** after save, and back-navigation to **This Week** uses clean replace behavior instead of stack-growing push behavior; (2) coach writing keyboard usability for multiline fields was hardened (including stronger re-scroll behavior) for **What Matters Next** and **Weekly Focus**, validated on device; (3) coach workflow cleanup now lands **Log Session** on the main **Training** tab and de-emphasizes Add Kid roster UI in Dev when linked athletes already exist (manual add fallback still available in Dev, production Add Kid behavior unchanged). A **Dev-only** parent-side **New coach update** banner is now implemented as an MVP awareness layer from `weekly.updatedAt` vs local last-seen state; no production/TestFlight rollout is claimed for this banner in this handoff.

On `dev`, the Coach Share lane now includes a role split (**Coach** and **Parent**) with a role picker and role-specific profile entry behavior. Worker-backed sync is deployed and active for invite/redeem + shared athlete linking + weekly note/shared-athlete visibility. Two-device smoke succeeded in Dev: coach creates invite, parent accepts invite, parent adds athlete, and coach sees the athlete as linked. Current limitation remains unchanged for deeper data: parent-entered **training logs** and **competition data** still do **not** sync back to coach and remain local-only on the parent side.

## Git checkpoint

**Before build or release work:** run `git status -sb` (and the usual gates) so you see the exact tree on that machine — branch position and cleanliness can differ between clones.

Earlier handoff language about a **dirty tree**, **ahead by 22**, and **weekly sync living only in uncommitted changes** is **obsolete**. **Dev truth** is the **committed** history on `dev`, especially the **Family Huddle** story, **coach → parent publish**, and **link-binding / reconnect hardening** slice.

**TestFlight** is still **older shipped reality** until a new feedback build is uploaded and noted here — do not assume external testers match Dev.

**Recent commits (this slice):**
- `9d805a6` — Polish: tighten weekly routing and hide internal controls
- `4b37521` — enforce strict parent weekly link state and reconnect flow
- `af919e4` — polish coach-share copy and simplify unlink path
- `1a5d4e1` — improve competition sync recovery and unlink helper messaging
- `4fd1d99` — stabilize coach-parent link binding and publish readiness

## ODS founder roll-up rule
If MatMind had meaningful work today, that work should be reflected in ODS the same day.

Do not copy the full engineering handoff into ODS.
Instead, roll up the founder-level meaning:
- product movement
- user signal
- proof value
- strategic implications
- risks
- next move

## Process note (2026-03-22)
Continued **slice → device QA → fix**. **Family competition** and **household** work are **validated in local dev** on a tree that includes the commits above — not claimed for TestFlight. **Weekly sync** is the next **integration** step: worker + env + **two builds** before end-to-end smoke. Assume **older external tester devices** may be on a **build that does not yet include** sync changes until explicitly verified.

## Product / strategy (planning; not shipped product)
- Michelle feedback pushed **competition/tournament structure** toward **future AI analysis**.
- **Tier model / pricing** exploration started; **AI capabilities likely land in Pro by default**; **dashboard cost posture** under discussion.

## What we completed most recently

### 2026-04-01 — Build 21 bridge QA complete + training bleed fix + competition video upgrade
- **Build 21 bridge QA (final pass):** Multi-kid **invite truth** verified across **parent** and **coach**; **shared Family Huddle** model verified as **invite-scoped** with **last publish wins** (documented limitation until Option B)
- **Training bleed fix (critical):** Coach-logged kid **training sessions** no longer incorrectly appear on the **parent** side
- **Competition videos (coach-side only):** Up to **three** competition videos supported per competition entry on the coach path
- **Release readiness:** Build 21 is **ready for release flow** (cut → internal testers / coaches); external/TestFlight truth still follows upload + handoff update

### 2026-03-31 — Multi-kid truth, household polish, session persistence Phase 1, Family Huddle wording (Dev)
- **Multi-kid / invite alignment:** Parent **This Week** kid selector uses **truly linked kids** for the active invite in Dev; coach roster visibility improved for more accurate invite-linked multi-kid truth; parent can reach **Athletes on this invite** from the manage-coach link screen; parent and coach sides align more clearly on **invite-linked** athletes
- **Household save-state (coach kid detail):** Save control **disabled when not dirty**; **Saved** state after successful save; redundant helper text removed
- **Session persistence Phase 1:** Raw session API—`getSessions()`, `setSessions(next)`, `deleteSessionsForKid(kidId)`—with `app/(tabs)/training/[id].tsx` and `src/storage/coachKidStore.ts` rewired; **no** AsyncStorage key/schema/version change
- **Family Huddle / weekly note copy (clarity only):** Coach and parent screens use wording that reflects the **shared-per-invite** published model; this is **not** Option B (per-athlete published weekly plans inside one invite)
- **Model truth (research / current product, not solved today):** Local coach **weekly focus** remains **kid-scoped**; synced **Family Huddle / weekly note** remains **invite-scoped** with **last publish wins** for the invite; **parent child pills do not change** which published Family Huddle content is shown

### 2026-03-26 — parent weekly dashboard redesign
- Rebuilt the parent weekly screen into a stronger “what to do this week / what to track this week” flow
- Used live spouse/parent usability feedback to tighten copy, hierarchy, CTA clarity, and section behavior
- Preserved the working Family Huddle / publish / training / competition loop while improving the parent experience (same data layer; coach-parent sync behavior unchanged)

### 2026-03-26 — Custom Weekly Focus edit fix
- Fixed weekly-focus editing so **Custom Focus** is active/selectable again when editing an existing entry

### 2026-03-26 — 4-tab IA restructure for external feedback
- Promoted the weekly coach/parent lane to a main **This Week** tab (`app/(tabs)/this-week/**`)
- Consolidated Fundamentals + Gear into **Learn** (`app/(tabs)/learn/**`)
- Removed Welcome from the permanent tab bar (kept as hidden/onboarding entry)
- Updated redirects/dev links and fixed leaked scaffold tabs in Expo Router

### 2026-03-27 — weekly routing polish for next feedback build
- Narrow release-shaping cleanup after two-device QA: coach **This Week** root, parent **This Week** root, **Training**, **Learn**, and routing sanity
- Cleaned up **This Week** / **Learn** shell; fixed duplicate top headers by letting nested stack headers own those tabs
- Coach **This Week** tab root: short coach landing + CTA into Kids roster; coach root no longer shows parent-facing Family Huddle, parent competition shell, parent link-refresh shell, or root weekly-focus preview
- Parent **This Week** tab root: keeps the family-facing weekly experience
- Reduced visible internal/dev exposure for feedback logic; **Profile** internal controls remain available intentionally in dev/internal contexts
- Commit: `9d805a6` — *Polish: tighten weekly routing and hide internal controls*

### 2026-03-30 — Build 20 QA cleanup + verification (Dev)
- Parent training save flow now returns directly to **This Week** after save
- Back to **This Week** behavior moved from stack-growing push to clean replace
- Coach note terminology cleanup in UX copy/actions:
  - **Coach Note**
  - **Optional detail**
  - **Save Note**
  - **Edit Note**
- Multiline keyboard/input visibility fixed across coach writing flows:
  - **What Matters Next**
  - **Weekly Focus**
- Final multiline fix required stronger re-scroll behavior on multiline fields; verified on device
- Coach **Log Session** now lands on main **Training** tab (not forced `/training/new`)
- In Dev, Add Kid roster UI is de-emphasized when linked athletes already exist; manual add fallback remains available
- Production behavior for Add Kid remains unchanged
- Added **Dev-only** parent-side **New coach update** banner MVP:
  - Banner uses server `weekly.updatedAt` + local `lastSeenUpdatedAt` per `linkToken`
  - Banner appears only on successful fetch when server timestamp is newer than last seen
  - Offline cache reads do not advance seen-state
  - No production/TestFlight behavior change

### 2026-03-25 — strict parent link-state + reconnect hardening
- Added canonical invite-token normalization and shared coach-link binding helpers
- Tightened parent weekly “linked” truth so weekly sync now requires a stricter redeemed parent channel, not just any local active weekly row
- Fixed the parent auto-relink contamination loop: after remove-link, parent now stays truly unlinked until an intentional reconnect
- Fresh invite → intentional reconnect → relink existing child → coach publish flow now passes again in Dev
- Added a safe coach publish fallback when exactly one active writer session contains the child, but otherwise fail honestly
- Roster truth and publish truth are now more tightly aligned
- Temporarily added DEV tracing for auto-relink; used it to identify the problem path — final passing QA came after the strict linked-state fix

### 2026-03-25 — coach/parent unlink/revoke honesty
- Revoke/remove-link paths now clear local linked presentation more honestly
- Coach roster no longer relies as heavily on stale local child linkage alone
- Parent and coach are less likely to diverge into “looks linked here, not writable there” states

### 2026-03-25 — external-feedback polish follow-up
- Removed duplicate parent unlink affordance in the main parent weekly flow
- Reduced remaining visible “pilot” language in key user-facing areas
- Tightened parent athlete-linking copy
- Polished Family Huddle copy on the remaining rough cards

### 2026-03-24 — Family Huddle / weekly story rework
- Parent “Read together” was rebuilt into a stronger five-card family story:
  1. Mission of the week
  2. What we sharpened with Coach
  3. On the mats this week
  4. Study the move
  5. The bigger journey
- New shared story-card mapper and modal:
  - `src/family/readTogetherStoryCards.ts`
  - `src/family/ReadTogetherStoryModal.tsx`
- Parent entry CTA updated to **“This week’s family huddle”**
- Parent weekly heading is now family/invite-scoped, not athlete-scoped
- Family link behavior works on parent side, including YouTube / Instagram family links
- Card 2 recap now updates and clears correctly after publish

### 2026-03-24 — Coach Family Huddle publish clarity
- Coach kid detail was simplified and re-ordered:
  - stronger **What matters next**
  - **How it’s going** visually subordinated
  - Family / Publish lane moved higher and made easier to understand
- Coach-side Family Huddle source map now mirrors parent card headings
- Weekly focus editor labels now align with Family Huddle:
  - Mission of the week
  - What we sharpened with Coach
  - Study the move
- Preview CTA renamed to **Preview Family Huddle**

### 2026-03-24 — Parent unlink / relink hardening
- Parent can unlink a child from coach without deleting the child profile
- Parent can relink an **existing** child profile to the invite/session instead of creating duplicates
- Reconnect flow now surfaces existing kids first

### 2026-03-24 — Competition sync hardening
- Parent-to-coach competition create/delete is working in Dev on the intended edit/delete path
- Synced competition rows no longer expose swipe delete on parent weekly list
- Coach-side competition refresh behavior is reliable with explicit refresh control
- Invite clutter on coach side was reduced and invite cards now show linked athlete context

### 2026-03-22 — Family Competition parent lane (**committed** locally: `6e10dd7` → `c1b4369`, `d5cb4af`, `353f6bd`)
- **Parent-owned local lane** on the Coach Share weekly surface: **add / edit / delete** competition entries for the family view, **format** support, **month grouping** with **chevron** expand/collapse, **multi-kid child chips** (selection stored per device; resolves against pilot roster via `src/family/coachShareCompetitionBuckets.ts`), and a **stronger family palette** aligned with the weekly story.
- **Screens / wiring:** `app/(tabs)/profile/coaches/family-competition/edit.tsx` (hidden route in `app/(tabs)/_layout.tsx`); list + navigation from `app/(tabs)/profile/coaches/index.tsx`; shared bucketing/helpers in `coachShareCompetitionBuckets.ts`; stores/types as in `kidCompetitionStore`, `coachKidStore`, `src/types/coachKid.ts`.
- **Explicit scope:** this is **local AsyncStorage / on-device** behavior for the family competition lane — **not** replicated by the weekly sync milestone below.

### 2026-03-22 — Household grouping + editing (**committed:** `83588d7` and related roster work)
- **Household label on create** when adding a pilot kid; **roster grouped by household** on `kids.tsx`; **edit household** on existing **`kid/[kidId]`** detail.
- **Explicit scope:** household metadata is **local** to the device like the rest of the pilot roster until a future sync design ships.

### 2026-03-22 — Coach add-kid form keyboard (**committed:** `f7873a3`)
- **Keyboard visibility** issue on the coach **add-kid** form addressed (layout / scroll behavior as implemented in `kids.tsx`).

### 2026-03-23 — Weekly sync + shared-athlete dev smoke (**deployed + validated in Dev**)
- **Intent in this slice:** worker-backed invite/redeem + shared athlete link + weekly note/shared-athlete visibility, not full parent data replication.
- **Coach path:** create/link session (tokens + writer secret), publish weekly payload (`src/coach/weeklyFocusPublish.ts`), and consume worker APIs through `src/services/coachWeeklySyncApi.ts`.
- **Parent path:** join/redeem invite, parent-side athlete add, weekly document fetch and cache (`src/storage/coachWeeklySyncCacheStore.ts` and related Coach Share UI files).
- **Worker:** `coach-sync-worker/` is now deployed; invite flow and shared-athlete link worked after redeploy.
- **Validated in Dev (two-device):** coach invite -> parent accept -> parent adds athlete -> coach sees linked athlete.
- **Current sync boundary:** parent-entered competition/training rows remain local-only; these do not yet sync back to coach.

### 0) Family Coach Share weekly surface + join + weekly story (`624a50e` → `ec7c8f5`)
- **Profile** entry line: **“This week with your coach”** (`app/(tabs)/profile.tsx`).
- **Coach Share home** weekly framing: **“This week together”**; **finite weekly story** with step label **Read together · N of M**; **early-exit** control so families are not trapped in the story.
- **Join** flow polish and copy (e.g. **“This week together”** privacy note on device-only storage in `join.tsx`).

### 1) Competition: structured context + form polish (`746a1af`, `a3dfaa6`)
- **Types / persistence**: optional **`eventStatus`**, **`organizationOrPromoter`**, **`outcomeKind`** on `KidCompetitionEntry` (`src/types/coachKid.ts`); wired through store and **competition/edit** for future AI-readiness.
- **Form UX**: field visibility and order fixes, **notes** scroll behavior, **save helper**; **Save / Delete** actions moved back into the **normal scroll flow** (not pinned outside scroll).

### 2) AI Drafting Slice 1 — `what-matters-next` (`6d57f00`, `23a4047`)
- **Coach-in-the-loop** flow on `app/(tabs)/profile/coaches/kid/[kidId]/what-matters-next.tsx`: load local payload → **mock generator** → modal **review** → coach **applies** to drafts or **discards** (**no auto-save** from drafting).
- **Implementation**: `src/ai-coach/whatMattersNextDraftTypes.ts`, `loadWhatMattersNextDraftPayload.ts`, `whatMattersNextDraftGenerator.ts` — **deterministic local stand-in** until a real provider exists (`mockWhatMattersNextDraftFromPayload` / `getDefaultWhatMattersNextDraftGenerator`).
- Copy/instructions tuned for **adoption** and clarity that this is **assistive**, not autonomous.

### 3) Coach kid profile: standing guidance, guidance-first stack, swipe deletes (`56f7b43` → `89f0813`) — prior day, still current
- **Standing guidance — “What matters next”** (`kidStandingGuidanceStore`, `what-matters-next`): per-kid headline + optional detail; **top card** on kid detail; cleared when the kid is roster-deleted.
- **Guidance-first top stack** on kid detail: *What matters next* → *This week’s focus* → *How it’s going* (outcome + append-only **check-ins** + this-week list) → *This week’s training* → *Competition*.
- **Lower-half simplification**: compact summary cards; week lists **cap at 3 rows** with overflow to **History** / **Training** where relevant.
- **Editability**: `weekly-focus` and `competition/edit` support **`entryId`** for in-place edits; **`progress-reflection`** screen for editing a saved check-in; **`history`** opens the correct editor (focus vs check-in) per row.
- **Swipe-to-delete** (kid detail): saved **check-ins**, **this-week training sessions**, and **competition** rows — confirm, then persist.
- **Shared delete helpers**: `deleteKidWeeklyFocusEntryById` (`coachKidStore`) and `deleteSessionById` (`sessionsStore`) back the swipe paths and keep persistence aligned with the training editor / weekly-focus log.
- **Tab layout**: hidden routes registered for `what-matters-next` and `progress-reflection` (`app/(tabs)/_layout.tsx`).

### 4) Coach Share kid tracking flow + weekly focus history (`13f09f5`)
- **Kids roster** (`/profile/coaches/kids`): add a kid, list pilot roster, **swipe-to-delete** with confirmation.
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **this week** focus (latest log for Monday-week), **Set / edit this week’s focus** → `weekly-focus` (templates + custom; **append-only** logs; **edit via `entryId`** when improving an existing row), **History** → `history` (grouped by week, expandable; opens appropriate editor).
- **How it’s going (was: progress reflections on detail)**: outcome chips + notes on kid detail append **check-ins** for the week (append-only); gated on having a focus saved for the week. Tap a row → `progress-reflection`; swipe → delete check-in.
- **`coachKidStore`**: `KidsById` + `kidWeeklyFocusEntries` in AsyncStorage; caps (e.g. 60 focus rows/kid); weekly focus rows removed when a kid is hard-deleted (see `9fb7e3a` cascade). Roster hard-delete also removes **standing guidance** (`deleteKidPilot` order: competitions incl. media → linked training sessions → weekly focus → standing guidance → roster).

### 5) Kid competition tracking + roster hard-delete (`9fb7e3a`)
- **Competition** on kid detail: month-grouped list; **Add/edit** via `competition/edit` (tournament name, date, result, notes, optional video; **plus** optional structured fields `eventStatus` / `organizationOrPromoter` / `outcomeKind` as of 2026-03-21).
- **`kidCompetitionStore`**: create/update/delete; per-kid cap (60); **best-effort delete of persisted video files** when entries are removed or a kid is deleted.
- **`persistCameraRollMedia`**: copy picked camera-roll media into `documentDirectory/media/` (same pattern as training sessions); `bestEffortDeletePersistedMedia` for cleanup.
- **Roster delete** (`deleteKidPilot`): ordered cleanup **competitions (incl. media) → linked training sessions (kidId) → weekly focus → standing guidance → roster** to avoid orphan `kidId`s and stray pilot data.

### 6) Kid training linkage + progress reflections (`ab85fcd`)
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **This week’s training** with CTA to log via `/training/new?date=...&kidId=...`; session rows open the training editor; **swipe** deletes via `deleteSessionById`.
- **Training tab** (`app/(tabs)/training.tsx`): when `kidId` param is present, sessions are filtered to that kid and the “Add Session” CTA preserves `kidId`.
- Session editor (app/(tabs)/training/[id].tsx): persists kidId on the saved session so kid linkage survives navigation.
- **Check-ins / reflections**: this-week list on kid detail reflects saved check-ins; deep-edit on `progress-reflection`.

### 7) Still in place from prior Coach Share pilot work (unchanged intent)
Parent-first Coach Share hierarchy, coach pilot preview quality, **custom focus** in templates, and **reference link** support (**YouTube + Instagram**) on the template/preview path.

## What passed

### Gates
- `npx tsc --noEmit` and `npx eslint .` passed at **`83588d7`** for an **earlier** committed batch (per prior session discipline); **re-run both** on current `dev` before trusting release readiness (includes routing polish through **`9d805a6`**).
- The **uncommitted weekly-sync working tree** has **not** been asserted as gated in this handoff — **re-run both** after committing or before any push/release cut.

### Production config validation
Validated:
- `name = MatMind Jiu Jitsu`
- `ios.bundleIdentifier = com.ortizdigitalstudio.matmind`
- `extra.appVariant = prod`

### Product / release validation
Validated:
- Dev-validated parent weekly redesign still preserves **coach → parent weekly publish**
- Dev-validated parent **training** and **competition** flows still pass after the redesign (in the tested Dev loop)
- Dev-validated **Custom Weekly Focus** editing works again (Custom Focus path when editing an existing entry)
- Dev-validated **4-tab** structure (**This Week** / **Training** / **Learn** / **Profile**) is in place in Dev
- **2026-03-27 (Dev):** two-device QA passed after weekly routing polish for coach **This Week** root, parent **This Week** root, **Training**, **Learn**, and basic routing sanity—**not** claimed for TestFlight until a new build ships and is documented here
- **2026-03-30 (Dev):** Build 20 QA cleanup and on-device verification passed for parent save/back nav behavior, coach multiline writing visibility, and coach Log Session landing behavior
- **2026-03-31 (Dev):** Multi-kid invite alignment, household save-state behavior, session persistence Phase 1 wiring, and Family Huddle wording validated in the Dev lane; **TestFlight** is still **not** updated or claimed for this slice until a new build ships and is documented here
- **2026-04-01 (Dev):** Build 21 bridge QA complete—multi-kid invite truth, Family Huddle shared-invite model, training bleed fix, and coach-side multi-video competition entries verified in the Dev lane; **ready to cut Build 21** for internal testers/coaches; **TestFlight** remains stale until a new build ships and is documented here
- **2026-03-30 (Dev):** parent **New coach update** awareness banner is implemented as **Dev-only MVP** and is intentionally not claimed for production/TestFlight
- Dev-validated fresh-path reconnect flow still passes (unlink → fresh invite → intentional reconnect → relink → publish → parent receive)
- Dev-validated parent stays unlinked until intentional reconnect (no surprise auto-link from a fresh invite alone)
- Dev-validated coach publish after fresh reconnect passes
- Broader **TestFlight** reality is still not updated until a new build ships and is documented; treat TestFlight as stale vs Dev until then
- Build 18 is still the latest documented TestFlight reality for broader testers, and is older than the newest Dev-validated shared-athlete role-split slice
- **2026-03-21 batch** (family weekly Coach Share surface, competition structured fields + form polish, mock **What matters next** drafting): treat as **Dev / local** until a new TestFlight is explicitly validated and noted here—not assumed for **broad** TestFlight testers
- **2026-03-22 batch** (**Family Competition** lane, **household** roster/editing, **keyboard** fix, palette): **working in local dev** on commits through **`83588d7`** — **not** claimed for TestFlight or broad testers
- **Weekly two-device sync + shared athletes:** validated in Dev on a two-device setup; worker-backed invite/redeem and athlete linking are working in that lane
- **2026-03-24 batch:** Dev-validated Family Huddle end-to-end (coach publish -> parent weekly family note/link -> parent Read together / Family Huddle flow)
- **2026-03-24 batch:** Dev-validated parent unlink/relink hardening (unlink does not delete child profile; relink reuses the existing child without duplicates)
- **2026-03-24 batch:** Dev-validated competition create/delete sync on the intended edit/delete path (synced competition rows no longer expose swipe delete on the parent weekly list; coach-side competition refresh is reliable with explicit refresh control)
- **TestFlight boundary:** still do not overclaim TestFlight availability until a new build is explicitly shipped and documented
- **Competition/training cross-device sync:** broader training sync remains out of scope here; parent-entered training logs can still reflect device-local training activity realities on parent (no broader parent->coach training replication implied in this slice)
- **Kid roster / standing guidance / weekly focus / check-ins / kid-linked training / competition + swipe row deletes:** exercised via **Dev / local pilot** (not stated as live in the current TestFlight build)
- **TestFlight** navigation may still differ from Dev (4-tab **This Week** / **Learn** stack) until a new build is uploaded and documented
- Weekly template/preview on the coach side remains cleaner (debug data hidden; clearer preview state)
- Custom focus is supported in weekly templates and preview
- Reference link pill supports YouTube + Instagram links

## Commits landed most recently
- `9d805a6` — Polish: tighten weekly routing and hide internal controls
- `83588d7` — Add household editing for existing coach pilot kids  
- `f7873a3` — Fix keyboard visibility in coach kid add form  
- `d5cb4af` — Add family competition child selection for multi-kid households  
- `353f6bd` — Strengthen family palette for weekly story and competition  
- `c1b4369` — Add shared family competition flow and format support  
- `6e10dd7` — Fix family competition add form reset behavior  
- `8510ce8` — Docs: update handoff and recap for family weekly, AI draft, and competition context  
- `23a4047` — Add coach-guidance drafting flow for what matters next  
- `6d57f00` — Simplify AI drafting instructions for coach guidance  
- `746a1af` — Add structured competition context for AI-ready analysis  
- `a3dfaa6` — Move competition actions back into scroll flow  
- `ec7c8f5` — Add early exit control to family weekly story  
- `ee6df4e` — Polish family-facing coach join flow  
- `624a50e` — Refactor Coach Share into a warmer family-facing weekly view  
- `89f0813` — Add shared delete helpers for coach kid row actions  
- `084b355` — Standardize coach kid row deletion with swipe actions  
- `4532ca7` — Refactor coach kid top stack into guidance-first hierarchy  
- `56f7b43` — Feat: add coach guidance hero and harden kid pilot editing flows  
- `ab85fcd` — Feat: add kid training linkage and progress reflections  
- `9fb7e3a` — Feat: add kid competition tracking and roster delete  
- `13f09f5` — Feat: add Coach Share kid tracking flow and weekly focus history  
- `ca25164` — Docs: finalize handoff after Coach Share pilot work  
- `c2daab1` — Docs: update handoff for Coach Share pilot progress  
- `469ea58` — Feat: add custom focus option to Coach Share templates  
- `745059e` — Feat: expand Coach Share pilot preview with custom focus and IG links  

## Locked product / workflow decisions
- Terminal-first execution remains a hard project rule
- Build 12 is the **last documented** coach-testing build in TestFlight until handoff is updated after a new upload (beta reality)
- Feedback triage is intentionally tabled short-term
- Weekly coach/parent flows (**This Week** tab in Dev; historically “Coach Share” family surfaces) are the primary lane for real-world feedback prep; **TestFlight** may still show an older tab layout until a new build ships
- **Per-kid tracking** under **This Week** remains the highest-ROI lane for Kyle internal testing (local pilot / Dev until we ship a new build)
- Kid roster / weekly focus / **coach kid competition** rows / kid-linked training session data remain **local-only (AsyncStorage + on-device media copies)** for the pilot. The **weekly sync experiment** (when committed and deployed) targets a **narrow weekly message document** only — **not** a full multi-device replication of competition or training.
- **AI Drafting Slice 1** is **mock/on-device** only until a real provider is integrated; **no auto-save** from drafting; coach **apply** is the save path

## Open loops
- **Family Huddle / weekly note (explicit):** Still **invite-scoped** with **last publish wins** for the invite—this is the **current shipped model**, not per-athlete switching on the parent side
- **Per-athlete weekly plans:** **Deferred to Option B** (not implemented; design + worker contract are the next strategic slice after Build 21 ships internally)
- **Parent-side competition video archive:** **Not implemented**; multi-video competition support in this build is **coach-side only**
- Final external-feedback TestFlight go/no-go checklist still needs a dedicated pass after internal Build 21 validation
- Parent weekly lane is much stronger but may still get another visual/personality pass
- Still need to decide whether coach should keep “Add a kid” in the external-testing model
- Need a final decision on whether the current IA is the exact external-feedback build IA or a testing-phase simplification
- Broader training sync remains out of scope
- "The bigger journey" card is still mostly auto/fallback driven
- Black Belt testing should focus on comprehension and flow quality, not assume all cross-device data types sync

## Best next-session recommendation
1. **Cut Build 21**
2. **Ship to internal testers / coaches**
3. **Begin Option B design + worker contract**

## Suggested restart commands for next session
- `git status -sb`
- `git log -8 --oneline`
- `sed -n '1,280p' "docs/dev-handoff.md"`
- `sed -n '1,220p' "docs/recaps/2026-03-31_dev-recap.md"`

## Assumptions
- Kyle internal **Coach Share + kid pilot** usability remains the highest-ROI signal for this lane.
- Broader external feedback triage can stay tabled until this pilot lane is stable enough for internal use.
- **Gates** were last fully documented for an older snapshot (**`83588d7`**); latest `dev` includes **`9d805a6`** — **re-run both** gates on the current tree before trust; the **dirty** sync tree (if any) still needs a fresh run before trust.
- **Spouse / external tester device** build age is **unknown** — assume **no sync features** until a matching dev/client build is installed.
