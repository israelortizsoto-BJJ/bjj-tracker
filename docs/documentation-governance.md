# Documentation Governance

**Status:** Authoritative under Engineering OS v1.1
**Effective:** 2026-07-17
**Scope:** Living MatMind documents — ownership, update triggers, and prohibited content

This document is the subordinate living-document ownership map under `docs/ENGINEERING_OS.md`.

`docs/ENGINEERING_OS.md` is the supreme MatMind engineering authority. This file maps document ownership and update triggers. `docs/engineering-daily.md` is the single daily index. No separate MatMind EOD artifact is created.

Engineering OS v1.1 establishes a single owner and responsibility for every living document.

---

## Engineering OS

| | |
| --- | --- |
| **Path** | `docs/ENGINEERING_OS.md` |
| **Owner** | Engineering Leadership |
| **Updated when** | Explicit Engineering Leadership mission with a version update |
| **Never contains** | Session diary; product roadmap; separate EOD artifact |

---

## Engineering Daily

| | |
| --- | --- |
| **Path** | `docs/engineering-daily.md` |
| **Owner** | Engineering |
| **Updated when** | Daily closeout is authorized — one concise append-only entry per engineering day |
| **Never contains** | Duplicate evidence archive; separate EOD artifact |
| **Rule** | Single daily index. Corrections append as labeled amendments. History is never silently rewritten. |

---

## Product Roadmap

| | |
| --- | --- |
| **Path** | `docs/product/product-roadmap.md` |
| **Owner** | Product |
| **Updated when** | Product direction changes; Epic changes; Release changes |
| **Never contains** | Git commits; Engineering investigations; Debugging |

---

## Engineering Checkpoint

| | |
| --- | --- |
| **Path** | `docs/engineering-checkpoint.md` |
| **Owner** | Engineering |
| **Updated** | Every engineering session |
| **Never contains** | Product roadmap duplication |

---

## Dev Handoff

| | |
| --- | --- |
| **Path** | `docs/dev-handoff.md` |
| **Owner** | Engineering |
| **Rule** | Append-only. Never rewritten. Historical record. |

---

## Engineering Parking Lot

| | |
| --- | --- |
| **Path** | `docs/engineering-parking-lot.md` |
| **Owner** | Engineering |
| **Contains** | Deferred work only |
| **Never contains** | Bugs; Active work |

---

## Architecture Certification

| | |
| --- | --- |
| **Path** | `docs/architecture/certification/` (register + companions) |
| **Owner** | Architecture |
| **Updated** | Only after certification |

---

## Developer Prompt

| | |
| --- | --- |
| **Path** | `docs/master-prompt-developer.md` |
| **Owner** | Engineering Leadership |
| **Updated** | Changes rarely |

---

## Daily Restart

| | |
| --- | --- |
| **Path** | `docs/master-prompt-daily-restart.md` |
| **Owner** | Engineering Leadership |
| **Contains** | Startup procedure only |

---

## Summary

| Document | Owner | Update cadence | Forbidden content / rule |
| --- | --- | --- | --- |
| Engineering OS | Engineering Leadership | Explicit mission + version update | Session diary, product roadmap, separate EOD |
| Engineering Daily | Engineering | Authorized daily closeout (one entry per day) | Duplicate evidence archive; separate EOD; never rewrite |
| Product Roadmap | Product | Direction / Epic / Release change | Commits, investigations, debugging |
| Engineering Checkpoint | Engineering | Every engineering session | Product roadmap duplication |
| Dev Handoff | Engineering | Append on closeout | Never rewrite |
| Engineering Parking Lot | Engineering | When work is deferred | Bugs, active work |
| Architecture Certification | Architecture | After certification only | Ad-hoc session notes |
| Developer Prompt | Engineering Leadership | Rarely | Session noise |
| Daily Restart | Engineering Leadership | Rarely (procedure only) | Non-startup content |

---

# Information Flow

Every class of information has one canonical destination. Write it there. Reference it elsewhere. Do not copy narrative across layers.

| Information Type | Canonical Document | Owner | When Updated | Never Duplicate In |
| --- | --- | --- | --- | --- |
| Engineering Operating Contract | `docs/ENGINEERING_OS.md` | Engineering Leadership | Explicit mission with version update | Engineering Daily; Checkpoint; Dev Handoff; Product Roadmap |
| Daily Engineering Index | `docs/engineering-daily.md` | Engineering | Authorized daily closeout — one entry per day | Separate EOD artifact; Checkpoint as diary substitute; long investigation narrative copies |
| Product Mission | `docs/product/product-roadmap.md` | Product | Product direction / mission changes | Engineering Checkpoint; Dev Handoff; Parking Lot; master prompts |
| Product Vision | `docs/product/coach-experience-vision.md` | Product | Vision / North Star changes | Engineering Checkpoint; Dev Handoff; Parking Lot; Product Roadmap Epic bodies |
| Product Epics | `docs/product/product-roadmap.md` | Product | Epic create / status / sequencing changes | Engineering Checkpoint; Dev Handoff; Parking Lot |
| Release Plans | `docs/product/product-roadmap.md` | Product | Release status / sequencing changes | Engineering Checkpoint; Dev Handoff; Parking Lot |
| Engineering Progress | `docs/engineering-checkpoint.md` | Engineering | Every engineering session | Product Roadmap; Product Vision; master prompts |
| Certified Architecture | `docs/architecture/certification/` | Architecture | Only after certification | Product Roadmap; Dev Handoff as substitute authority; ad-hoc session notes |
| Engineering Investigations | `docs/investigations/` (indexed by `docs/architecture/certification/active-investigation-register.md`) | Engineering | When an investigation opens, narrows, or lands evidence | Product Roadmap; Parking Lot; master prompts |
| Engineering Decisions | `docs/decisions.md` | Engineering | When irreversible or high-leverage engineering decisions are made | Product Roadmap; Product Vision; Dev Handoff narrative copies |
| Deferred Engineering | `docs/engineering-parking-lot.md` | Engineering | When work is explicitly deferred with a resume trigger | Product Roadmap; Engineering Checkpoint as active work; bug trackers |
| Historical Engineering Timeline | `docs/dev-handoff.md` | Engineering | Append on Engineering OS closeout | Product Roadmap; rewritten Checkpoint history; Parking Lot |
| Startup Procedure | `docs/master-prompt-daily-restart.md` | Engineering Leadership | Rarely — procedure changes only | Developer Prompt; Engineering Checkpoint; Product Roadmap |
| Engineering Rules | `docs/master-prompt-developer.md` | Engineering Leadership | Rarely — doctrine changes only | Daily Restart; Engineering Checkpoint; Product Roadmap |

---

# Engineering Lifecycle

Product and engineering information moves through a single governed lifecycle:

```text
Idea
  ↓
Vision
  ↓
Roadmap
  ↓
Engineering Checkpoint
  ↓
Architecture Certification
  ↓
Dev Handoff
```

| Stage | Meaning | Canonical home |
| --- | --- | --- |
| Idea | Emerging product or engineering intent | Promote into Vision or park — do not leave as undocumented session noise |
| Vision | Long-horizon product North Star | `docs/product/coach-experience-vision.md` |
| Roadmap | Mission, Epics, release sequencing | `docs/product/product-roadmap.md` |
| Engineering Checkpoint | Active session progress and recoverable floor | `docs/engineering-checkpoint.md` |
| Architecture Certification | Evidence-backed certified architecture | `docs/architecture/certification/` |
| Dev Handoff | Permanent historical engineering timeline | `docs/dev-handoff.md` |

**Deferred exit:** Work that is intentionally stopped exits the lifecycle into the Engineering Parking Lot (`docs/engineering-parking-lot.md`). Parked items are not active Checkpoint work, not Product Roadmap Epics, and not bugs. Every parked item requires a resume trigger before it may re-enter at Engineering Checkpoint.
