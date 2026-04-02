# MatMind Build System (Locked Workflow)

## Purpose
Ensure consistent, high-quality product development by combining:
- Cursor (architecture + execution)
- ChatGPT (product + scope + risk)
- Operator (final decision maker)

This workflow is mandatory for all non-trivial feature work.

---

## Roles

### Cursor
- Scans repo
- Produces architecture-aware plan
- Executes code ONLY after approval

### ChatGPT
- Controls scope (prevents overbuild)
- Aligns work to product goals
- Identifies risks and migration strategy
- Breaks work into safe slices

### Operator (Israel)
- Final decision maker
- Approves plan before execution
- Ensures focus and discipline

---

## Process (Always Follow This Order)

### Step 1 — Cursor PLAN MODE (No Code)
Prompt Cursor:

Goal:
Move from invite-level weekly plans → per-athlete weekly plans.

Tasks:
1. Identify where weekly plan is stored
2. Identify all read/write points
3. Propose minimal migration strategy (add athleteId)
4. Propose implementation slices
5. Identify risks

Output:
- No code
- File-level impact
- Step-by-step plan

---

### Step 2 — Bring Plan to ChatGPT
- Paste full Cursor plan
- Do NOT summarize

---

### Step 3 — Product + Risk Analysis (ChatGPT)
- Remove unnecessary scope
- Align to product goal
- Identify hidden risks
- Define safe sequence

---

### Step 4 — Final Approved Plan
- Clear slices
- Exact execution order
- Guardrails defined

---

### Step 5 — Cursor Execution (Scoped)
Prompt Cursor:

"Execute ONLY Step [X].
Do not touch unrelated files.
Show full diff before applying."

---

### Step 6 — Test + Verify
- Run app
- Validate behavior
- Then move to next slice

---

## Guardrails

### Do NOT:
- Refactor unrelated code
- “Clean up architecture” broadly
- Change storage contracts without explicit plan
- Batch multiple features in one pass

### Only:
- Work within defined slice
- Make intentional, minimal changes
- Validate after each step

---

## Core Principle

We do not build based on assumptions.

We:
1. Identify real user problem
2. Define minimal solution
3. Execute in controlled slices
4. Validate before expanding

---

## Current Focus (as of Build 22)

Problem:
Coaches cannot give per-athlete guidance within same invite.

Target:
Introduce per-athlete weekly plans (athleteId dimension)

Constraint:
Maintain backward compatibility with existing invite-level system

---

## Reminder

You are not optimizing for code elegance.

You are optimizing for:
- clarity
- usability
- real-world coaching workflow
