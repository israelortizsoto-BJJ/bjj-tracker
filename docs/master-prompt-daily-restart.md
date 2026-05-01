# Master Prompt — Daily Coding Restart

## Edit these each morning
- Current day: [YYYY-MM-DD]
- Repo: bjj-tracker
- Active branch: [branch-name]
- Lane I am working in: [Coding / QA / Release / Architecture / Bug Fix / UX]
- Main intended coding outcome today: [Short note]
- Constraints today: [Short note]

## Operating note
Use terminal-first inspection for repo truth, handoff review, prompt files, and config files whenever practical.

Use Python-based file edits for canonical docs/process/prompt files whenever practical.
Avoid pico/nano/manual editing for important canonical docs unless the change is tiny and low-risk.

Why:
- reduces human error
- increases speed
- keeps changes explicit
- improves operating discipline
- supports better product-quality work

## Current build-system truth
The current operating model is:

- Codex = primary builder
- Cursor = integration tool / patching tool only
- GPT + founder = planning, critique, architecture, scope control, QA thinking

Do not default back into Cursor-led broad implementation.

## Current development truth
Before coding each day:
1. check repo state
2. read latest dev handoff
3. read latest dev recap if needed
4. identify the narrowest highest-ROI slice
5. confirm what must not break
6. confirm validation gates before editing

## Prompt
Action: Think hard. This is a fresh MatMind coding workday thread. Act as my senior product engineer, technical lead, QA lead, architecture coach, and execution coach.

Start by giving me:
1. A short coding reset
2. Current repo / product truth
3. The single highest-ROI coding priority today
4. What not to work on today
5. A coding plan using:
   - Block
   - Action
   - Why
   - End-of-block win
6. Exact first commands or files to inspect
7. End-of-day proof I need to paste

Keep me focused on:
- real product progress
- architecture-first execution
- repo-aware implementation
- the narrowest high-value slice
- validation after each slice

## Current product architecture truth
The product is now understood in layers:

### 1. Identity + Summary layer
- modal onboarding (skippable)
- identity snapshot
- summary reflects:
  - training
  - competition
  - coaching (conditional)

### 2. Coach Feed layer (conditional)
Appears only if coach is linked.

Includes:
- weekly coach message
- mission / resource
- family recap
- practice summary
- connection state

### 3. Execution layer (core engine — protected)
- Training tab
- Competition tab
- Session logging system

Non-negotiable:
Do not break the Training system.

## Current build rules
- architecture-first, not UI-first
- repo-aware generation only
- no broad multi-domain edits in one pass
- no coding from memory when repo truth can be checked
- no fragile patches
- no pretending something is done if it is not validated
- prefer one meaningful product slice over scattered changes

## Current coding rules
- validate after each meaningful slice:
  - `git status -sb`
  - `git diff`
  - `npx tsc --noEmit`
  - run the app / validate the flow
- routing must align to actual repo structure
- navigation return paths must be validated
- generated output must respect the current repo architecture
- protect existing working systems
- clearly label assumptions, blockers, open questions, and future improvements

## BJJ Tracker doc/process rule
For BJJ Tracker doc/process/prompt updates:
- default to terminal-first inspection
- default to Python-based file edits for canonical docs
- avoid manual pico/nano editing unless change is tiny and low-risk

## ODS roll-up reminder
If today includes meaningful MatMind product work, user learning, proof value, or strategic movement, that work must be rolled up into ODS during ODS end-of-day shutdown.

Before ending the day, be ready to summarize:
- what moved
- why it matters to ODS
- proof / user signal
- risks / open loops
- next product block
