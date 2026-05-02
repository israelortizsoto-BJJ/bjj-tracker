Codex System — Operating Rules (v2)

Core Workflow

1. GPT → defines scope + constraints
2. Codex → generates DIFF (no auto apply)
3. Operator → approves
4. Codex → applies patch
5. GPT → validates
6. Operator → QA in app
7. Cursor → minor patches only

Non-Negotiables

* DO NOT modify Training tab unless explicitly required
* DO NOT modify execution layer: app/(tabs)/training/[id].tsx
* DO NOT introduce new architecture
* ALWAYS match existing storage (AsyncStorage + StorageKeys)
* ALWAYS inspect repo before generating code
* NEVER guess file structure, variables, or flows

State Introduction Protocol

New state is FORBIDDEN by default.
It is allowed ONLY if ALL conditions below are satisfied AND explicitly approved in the prompt.

1. It represents real user behavior
2. It has a defined lifecycle
3. It integrates with system logic or data
4. It has a clear ownership layer

If any of these are missing → DO NOT ADD STATE

Builder vs Patcher

Codex (Builder)

* New features
* UI system translation (mock → repo)
* Storage logic
* Routing
* Data structures

Cursor (Patcher)

* Small UI tweaks
* Import fixes
* Minor adjustments only
* NO architecture or logic changes

Storage Rules

* Use AsyncStorage only
* Use existing StorageKeys
* Append to existing data
* No overwrites or schema changes
* No new storage systems without approval

Date Rules

* Must be YYYY-MM-DD
* Never store full ISO timestamps for grouping
* All grouping uses normalized date keys

SVG / Media Rules

* Inspect repo for existing usage first
* Check for react-native-svg and expo/vector-icons
* DO NOT assume support exists
* DO NOT install libraries automatically
* Propose install steps separately
* Reuse existing systems

UI Quality Standard (Apple-Level)

* 8pt spacing grid
* Clear hierarchy
* Minimal noise
* Large tap targets
* No default React Native buttons
* Use Pressable consistently
* Match existing app patterns before introducing new ones

Codex Prompt Standard (MANDATORY)

1. CONTEXT

* Exact file path(s)
* Exact function/component
* Current behavior

2. SCOPE

* ONE task only
* ONE section only
* No multi-component work

3. PRE-FLIGHT (REQUIRED)

* Confirm file exists
* Confirm target section exists
* Confirm variable names
* IF NOT FOUND → STOP and report

4. FORBIDDEN (CRITICAL)

* No logic changes
* No state changes
* No new components (unless explicitly allowed)
* No imports added
* No routing changes
* No storage changes
* No touching other files

5. ALLOWED

* Layout changes
* Style changes
* JSX restructuring within scope

6. TASK (DETERMINISTIC)

* Must be precise and unambiguous
* Example: Replace filter row JSX with segmented control using existing state and handlers, equal width buttons, 1px border, active filled, inactive transparent

7. SUCCESS CRITERIA

* Behavior unchanged
* Logic untouched
* UI matches defined structure
* Imports unchanged

8. CHANGE BUDGET

* Modify only target section
* Max ~20–40 lines changed
* No file-wide refactors

9. OUTPUT FORMAT

* BEFORE JSX
* AFTER JSX
* Unified diff

10. STOP CONDITION (CRITICAL)

* STOP after completing scoped section
* DO NOT continue beyond task

Codex Behavior Rules

* Act as deterministic executor
* NOT a creative assistant

If uncertain

* STOP
* Report issue
* DO NOT guess

If scope expands

* STOP immediately

Cursor Patch Rules

* No architecture changes
* No multi-file edits unless trivial
* No logic rewrites
* Always minimal diff

Reset Protocol
If unexpected UI changes, logic breaks, wrong files modified, or behavior changes:

1. STOP immediately
2. DO NOT patch forward
3. Re-anchor to repo truth
4. Re-run PRE-FLIGHT
5. Issue new constrained prompt

System Goal

* Stable architecture
* High-quality UI
* Predictable builds
* Zero drift
* Minimal token waste

Core Principle
We are not asking Codex to build. We are defining exactly how Codex is allowed to behave.
