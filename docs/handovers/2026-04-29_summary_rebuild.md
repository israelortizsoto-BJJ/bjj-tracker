# DEV HANDOFF — MATMIND SUMMARY REBUILD (4/28–4/29)

## CURRENT STATE

We attempted to rebuild the Summary screen using Codex-level design fidelity.

Key outcomes:

- Cursor failed to reproduce Codex UI exactly (layout drift, simplification, icon issues)
- SVG pipeline caused fallback rendering bugs ("U", "Unim")
- PNG fallback implemented but visual fidelity is still below Codex output
- Multiple summary systems created confusion
- Architecture is now cleaned and stable

## ARCHITECTURE DECISION (CRITICAL)

We have locked the system to a single source of truth:

src/features/summary_v2/

Deleted:
- src/features/summary/
- src/features/summary_codex/

Routing:

app/(tabs)/summary.tsx
→ export { default } from "@/src/features/summary_v2/SummaryScreenV2"

## CURRENT UI STATUS

Identity Card:
- Closest to Codex design
- Glow + ring system implemented

Athlete Switcher:
- Functional but not Codex-level UI

Metric Tiles:
- Not matching Codex (missing glass + layout fidelity)

Competition Card:
- Missing Codex structure + visual hierarchy

Icons:
- Using PNG fallback from assets/icons
- Working, but not final visual system

## ROOT PROBLEM

Cursor is an interpreter, not a generator.

It cannot reliably reproduce Codex-level UI.

## NEW BUILD STRATEGY (NON-NEGOTIABLE)

Codex CLI = PRIMARY BUILDER  
Cursor = INTEGRATION TOOL ONLY

---------------------------------------

## GIT SNAPSHOT

### Status

## summary-rebuild-v2
 M src/features/summary_v2/SummaryScreenV2.tsx
 M src/features/summary_v2/components/AthleteSwitcher.tsx
 M src/features/summary_v2/components/CompetitionCard.tsx
 M src/features/summary_v2/components/MetricTile.tsx

### Recent Commits

1adc1ef chore: finalize summary_v2 cleanup and prep for Codex CLI build  
d2b8662 chore: remove legacy summary systems and lock summary_v2 as single source of truth  
87d8d85 feat: codex identity card (pixel-perfect implementation)  
0c45e54 (tag: summary-pre-codex) Checkpoint: competition recording flow + editor updates  
77dadae Competition system v1 rebuilt  
2b54cc2 This Week UI fixes  

---------------------------------------

## NEXT SESSION PLAN (4/30)

### OBJECTIVE

Set up Codex CLI and rebuild Summary screen EXACTLY from design mock.

---------------------------------------

### STEP 1 — INSTALL CODEX CLI

npm install -g @openai/codex

---------------------------------------

### STEP 2 — NAVIGATE TO PROJECT

cd "/Users/ods/Repos/bjj-tracker"

---------------------------------------

### STEP 3 — START CODEX

codex

---------------------------------------

### STEP 4 — VERIFY ACCESS

list files in this repo

---------------------------------------

### STEP 5 — EXECUTE BUILD

Rebuild SummaryScreenV2 to exactly match the Codex design mock.

Requirements:
- Use existing IdentityCard (do not modify)
- Use PNG icons from assets/icons
- Implement athlete switcher with avatars + belts
- Build glass-style metric tiles (2-column layout)
- Build full competition card with stats + insight
- Match spacing, glow, typography exactly
- No simplification

Write directly to:
- src/features/summary_v2/SummaryScreenV2.tsx
- src/features/summary_v2/components/AthleteSwitcher.tsx
- src/features/summary_v2/components/MetricTile.tsx
- src/features/summary_v2/components/CompetitionCard.tsx

---------------------------------------

### STEP 6 — VALIDATE

git status -sb  
git diff  

npx tsc --noEmit  
npm run ios  

---------------------------------------

## BUILD ORDER

1. Athlete Switcher (Codex exact)
2. Metric Tiles (glass system)
3. Competition Card
4. Full screen integration
5. Spacing + polish pass

---------------------------------------

## DEFINITION OF DONE

- Matches Codex mock pixel-for-pixel
- Glow + ring system correct
- Athlete switcher matches top row design
- Tiles match hierarchy + spacing
- Competition card fully aligned
- No fallback UI
- No simplified layout

---------------------------------------

## FINAL NOTE

We are no longer attempting to guide Cursor into correctness.

We are switching to:

Codex builds → Cursor integrates

This is required to achieve exact UI fidelity.

---------------------------------------
