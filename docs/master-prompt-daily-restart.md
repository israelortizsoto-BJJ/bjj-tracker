# Master Prompt — Daily Coding Restart

## Edit these each morning
- Current day: [YYYY-MM-DD]
- Repo: bjj-tracker
- Active branch: [branch-name]
- Lane I am working in: [Coding / QA / Release / Architecture / Bug Fix / UX]
- Main intended coding outcome today: [Short note]
- Constraints today: [Short note]

# Architecture Certification

Before beginning engineering work:

Read:

docs/architecture/certification/CertifiedArchitectureRegister-v1.md

Also read:

docs/architecture/certification/protected-systems-register.md

docs/architecture/certification/active-investigation-register.md
Determine whether the subsystem being modified is:

CERTIFIED
PARTIALLY CERTIFIED
NOT CERTIFIED

Do not reopen certified architecture without new repository or runtime evidence.

If an investigation certifies a previously unknown boundary, update the Architecture Certification Register before ending the sprint.

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
## Handoff-first startup

Before any coding plan:
1. `git status -sb`
2. `git log -8 --oneline`
3. `sed -n '1,280p' "docs/dev-handoff.md"`
4. Read latest recap if needed: `docs/recaps/YYYY-MM-DD_dev-recap.md`
5. State assumptions explicitly before proposing work

Current slice truth lives in `docs/dev-handoff.md` — not in prompt memory.

## Current restart workflow

Before coding each day:
1. check repo state
2. read latest dev handoff (commands above)
3. read latest recap only if the dev handoff references it
4. Identify the narrowest highest-ROI slice from the current handoff.

   Validate:
   - the investigation is inside the Active Investigation Register
   - the subsystem is not already CERTIFIED
   4A. Define today's evidence target before opening source code.

    State the single uncertified boundary you intend to prove or narrow today. The sprint ends when that boundary becomes either CERTIFIED or NARROWED. Do not expand scope until the documentation has been updated or the investigation has been explicitly re-scoped.
5. confirm what must not break
6. confirm validation gates before editing

Current blockers (verify against latest handoff before planning):
- coach sync base URL must be present in the **running** app for connect flows
- validate connect E2E: Paste → Connect → Parent-athletes → Success strip → **This Week**
- QA **This Week** tab without regressing weekly sync, training, or competition

For deep doctrine (product architecture, DEBUG DOCTRINE, 9-step flow): read `docs/master-prompt-developer.md`.
For release / TestFlight days: read `docs/release-checklist-ios.md`.

## Documentation Ops reminder

Canonical docs follow the Documentation Ops pipeline:
1. Review reports in `reports/*.review.md` (DOCOPS-005)
2. Founder approves recommendations
3. Unified diffs in `reports/diffs/` (DOCOPS-006)
4. Apply engine runs only after explicit approval (DOCOPS-007)

Do not hand-edit canonical docs outside this pipeline unless the change is tiny and emergency-level.

## Current build-system truth
The current operating model is:

- Codex = primary builder
- Cursor = integration tool / patching tool only
- GPT + founder = planning, critique, architecture, scope control, QA thinking

Do not default back into Cursor-led broad implementation.

## Current development truth
Follow **Handoff-first startup** and **Current restart workflow** above — they supersede this checklist.

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

Before ending today's sprint:

If a previously uncertified boundary became proven:

1. Update CertifiedArchitectureRegister-v1.md
2. Update protected-systems-register.md if protection changes
3. Remove or narrow the item from active-investigation-register.md
4. Update docs/dev-handoff.md
