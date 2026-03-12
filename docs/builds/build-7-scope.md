# MatMind Build 7 Scope

## Build 7 goal
Make MatMind feel like a real multi-surface app without breaking focus.

This build should increase:
- product clarity
- visual polish
- app completeness
- confidence for testers and parents

This build should not become a broad expansion into half-finished features.

## Core principle
Each tab added or improved in Build 7 must be:
- intentionally shallow
- clearly useful
- visually polished
- easy to understand
- low-risk to ship

## Build 7 priorities

### Priority 1 — Branding systems pass
Goal:
Create a more intentional visual system across active screens.

Includes:
- logo integration where appropriate
- cleaner spacing rhythm
- more consistent card/button styling
- stronger visual hierarchy
- better use of color and typography
- modern feel across key screens

Does not include:
- full design system rewrite
- complex animation system
- app-wide refactor just for styling

### Priority 2 — Welcome tab
Goal:
Make Welcome feel like a real front door to the app.

Includes:
- clear MatMind identity
- strong first impression
- short value statement
- polished hero/header area
- clear paths into:
  - Training
  - Coach Share
  - Fundamentals
- optional light recent activity / next step area if easy

Does not include:
- onboarding rebuild
- complicated personalization engine
- heavy account/setup flow

### Priority 3 — Fundamentals starter tab
Goal:
Make Fundamentals feel like a believable BJJ learning surface.

Includes:
- clean category structure
- beginner-friendly organization
- starter shells for core fundamentals areas
- enough structure to show product direction

Possible category examples:
- Positions
- Escapes
- Guard
- Passing
- Takedowns
- Submissions
- Movement / solo drills

Does not include:
- full content library
- deep curriculum engine
- advanced filtering/taxonomy system
- complete coach authoring tie-in yet

### Priority 4 — Gear shell
Goal:
Make Gear useful in a simple, parent/kid-friendly way.

Includes:
- basic gi care guidance
- no-gi care guidance
- how to tie belt / how to wear gear basics
- why gear hygiene matters
- simple polished presentation

Does not include:
- shopping marketplace
- gear inventory system
- advanced equipment tracker
- brand/product recommendation engine

### Priority 5 — Coach Share momentum continues
Goal:
Do not stall Coach Share while broadening the app.

Includes:
- preserve current Coach Share flow
- keep Kyle pilot direction alive
- only take the next small coach-authoring step if it fits the build

Likely next Coach Share priority after current state:
- customize-from-template scaffold

Does not include:
- full coach editor
- full duplication logic
- backend sync
- academy rollout logic

### Priority 6 — Build 7 QA / polish pass
Goal:
Ship Build 7 as a coherent tester-facing step forward.

Includes:
- app-level nav sanity
- visual consistency check
- hidden route check
- no broken shells
- no obvious dead ends without explanation
- screenshot readiness if needed

Does not include:
- perfection
- broad cleanup unrelated to Build 7

## Scope limits

### Build 7 is allowed to be
- wider than Build 6
- more polished than Build 6
- more brand-forward than Build 6
- more complete-feeling than Build 6

### Build 7 is not allowed to be
- a full content product
- a full coach platform
- a full academy product
- a broad refactor build
- a “just add everything” build

## Recommended execution order

### Slice 1
Branding systems pass on active surfaces

Why first:
- improves all visible work
- helps app feel intentional
- informs later tabs

### Slice 2
Welcome tab

Why second:
- biggest first-impression gain
- easiest “this feels real now” lift

### Slice 3
Fundamentals starter tab

Why third:
- strengthens BJJ-specific identity
- feels important to parents/kids/coaches

### Slice 4
Gear shell

Why fourth:
- useful but lower ROI than Welcome/Fundamentals
- should remain intentionally light

### Slice 5
Coach Share next small step if capacity allows

Why fifth:
- maintain momentum without letting it swallow Build 7

### Slice 6
QA / polish / release prep

## Cursor task rules for Build 7

Cursor is approved for:
- screen scaffolds
- local UI implementation
- shallow tab builds
- styling refinement
- contained component cleanup
- 1–3 file tasks, sometimes slightly more if clearly bounded

Cursor is not approved for:
- broad architecture rewrites
- storage/model changes unless explicitly scoped
- release config work
- wide cross-app cleanup
- unsupervised refactors

## Workflow rules

For each Build 7 slice:
1. start new Cursor chat
2. ask for plan first
3. approve scope before edit
4. review diff
5. run:
   - `npx tsc --noEmit`
   - `npx eslint .`
6. test in app
7. commit only after proof

## Acceptance criteria by area

### Branding pass is done when:
- major active screens feel visually related
- buttons/cards/header areas feel more intentional
- app looks less default and more branded

### Welcome is done when:
- opening the app feels purposeful
- user can tell what MatMind is for
- user sees clear next paths

### Fundamentals is done when:
- it feels like a real BJJ learning tab
- categories are understandable
- it does not feel empty or random

### Gear is done when:
- it provides basic useful guidance
- it looks polished
- it does not pretend to be deeper than it is

### Build 7 overall is done when:
- app feels more complete
- tabs feel intentional
- no area feels dangerously overbuilt or fake-deep
- testers can feel meaningful progress

## Open design ideas to plan into Welcome / branding
- MatMind logo/open-circle motif
- color progression inspired by belt journey:
  - white
  - blue
  - purple
  - brown
  - black
- subtle jiu-jitsu identity without becoming cheesy
- modern, calm, polished presentation

These ideas should influence the design direction, but not force overbuilt animation work in this build.

## Best next coding move
Start with:
- Branding systems pass
- then Welcome tab

Do not start Fundamentals or Gear before the Welcome direction is locked.

## Strategic judgment
Build 7 should make MatMind feel substantially more real, not substantially more bloated.
