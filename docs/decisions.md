# MatMind — Core Decisions

Last Updated: 2026-02-22  
Branch: dev  

This document captures irreversible or high-leverage decisions.
We write them down so future versions of us do not rebuild confusion.

---

## Data Philosophy

### Athlete Data Is Longitudinal

Decision:
Performance-impacting attributes (weight, belt progression, health) are stored as time-series logs internally, while exposing a simple “current state” interface for MVP.

Why:
MatMind is not a profile app.
It is an athlete intelligence system.

Insight requires history.

Status:
Hybrid model initiated with Weight.

---

## Local-First Discipline

Decision:
MatMind is local-first (AsyncStorage) until real-world retention proves need for sync.

Backend Trigger:
When multi-device usage or Coach Share becomes necessary for active weekly users.

Why:
Mastery is built before scale.
We earn complexity.

---

## Minimal Surface Area

Decision:
UI remains calm, dark-first, and distraction-free.

Why:
Training is serious.
Clutter erodes reflection.

If a feature does not improve clarity, it does not ship.

---
## Quality Gate

Decision:
We do not commit without running:
- `npx tsc --noEmit`
- the Change Validation loop in definition-of-done.md

Why:
MatMind stays calm because the build process is calm.
## Architecture Pattern

Decision:
Major screens follow the 6-Block Structure.

Why:
Calm code reflects calm training.
Structure reduces mental noise.

---

## MVP Boundary

Decision:
No auth.
No cloud sync.
No dashboards.
No premature Pro Tier analytics.

Why:
First prove that athletes return weekly.
Habit before intelligence.

---