# MatMind Certified Architecture Register v1

> Status: Initial Working Baseline (Founder Velocity)
>
> Purpose:
>
> This register records architecture that has been certified through repository evidence, runtime evidence, QA certification, or engineering investigation.
>
> It is the engineering source of truth used before modifying core MatMind systems.
>
> This register references existing architecture documents. It does not replace them.

---

# Certification Legend

| Status | Meaning |
|---------|---------|
| CERTIFIED | Repository and/or runtime evidence establishes behavior. |
| PARTIALLY CERTIFIED | Portions are proven, but important boundaries remain uncertified. |
| NOT CERTIFIED | Insufficient evidence. Treat as active investigation. |

---

# Repository References

## Certification Scope

This register certifies architecture.

It does not replace:

- architecture specifications
- engineering handoffs
- repository archaeology
- runtime investigations

Certification records engineering confidence based on evidence available at the time of certification.

Primary architecture specifications remain in:

- docs/architecture/
- docs/canonical-athlete-authority-spec.md
- docs/overlay-architecture-v1.md
- docs/architecture/runtime-dependency-maps-v1.md
- docs/architecture/matmind-incident-capture-architecture-v1.md

This register certifies engineering knowledge. It intentionally references existing specifications rather than duplicating them.

---

# Certified Architecture Areas

## 1. Canonical Identity Ownership

Status

CERTIFIED

Confidence

High

Repository References

- docs/canonical-athlete-authority-spec.md

Certification Summary

Canonical athlete identity ownership has been repository certified.

Identity ownership, propagation and reconciliation are considered protected architecture.

Only repository-certified behavior may modify identity authority.

---

## 2. Competition Topology Ownership

Status

PARTIALLY CERTIFIED

Confidence

High

Repository References

- docs/architecture/competition/competition-runtime-governance-v1.md
- docs/architecture/competition/competition-runtime-invariants-v1.md

Certification Summary

Competition topology ownership and runtime governance have been repository certified.

Publisher ownership and certain runtime invalidation paths remain under investigation.

---

## 3. Coach Artifact Pipeline

Status

PARTIALLY CERTIFIED

Confidence

High

Repository References

- docs/overlay-architecture-v1.md
- docs/architecture/hydration-orchestration-v1.md

Certification Summary

The coach artifact pipeline from authoring through overlay hydration has been substantially certified.

The final publication and parent runtime interaction remain active investigations.

---

## 4. Overlay Merge Contract

Status

CERTIFIED

Confidence

High

Repository References

- docs/overlay-architecture-v1.md

Certification Summary

Overlay ownership, merge ownership and annotation ownership have repository certification.

Overlay merge behavior should be treated as protected architecture.

---

## 5. Competition Rendering Pipeline

Status

PARTIALLY CERTIFIED

Confidence

High

Repository References

- docs/architecture/runtime-dependency-maps-v1.md

Certification Summary

The rendering pipeline from storage through loadCompetitions, setEntries and CompetitionCard has undergone extensive repository and runtime certification.

The Parent runtime persistence investigation remains open.

---

## 6. Product Architecture

Status

CERTIFIED

Version

v1

Certification Date

2026-07-18

Confidence

High

Repository References

- docs/architecture/product/ProductArchitectureCertification-v1.md
- docs/architecture/product/MatMindCoachingIntelligenceCharter-v1.md
- docs/architecture/product/CoachFilmRoom-ProductVision-v1.md
- docs/architecture/product/CoachFilmRoom-ArchitectureCertification-v1.md
- docs/architecture/product/MatMindLearningLoop-v1.md

Certification Summary

Defines the constitutional product principles governing the Coach Film Room and future product systems before runtime implementation.

---

## 7. Media Runtime Foundation

Status

CERTIFIED

Protected by

media-runtime-certified-floor-v1

Version

v1

Certification Date

2026-07-19

Confidence

High

Repository References

- docs/architecture/certification/MediaRuntimeFoundation-v1-Certification.md
- src/playback/PlaybackCoordinator.ts
- src/playback/FilmRoomSessionCoordinator.ts
- src/playback/tests/filmRoomExclusivity.v0.test.ts

Certification Summary

Media Runtime Foundation is a protected certified subsystem.

Ownership boundaries (repository-certified):

- `PlaybackCoordinator` owns field engine lifecycle, field-local playback intent (including `replay`), field `seek` as engine I/O / sync execution, and measurement.
- `FilmRoomSessionCoordinator` owns synchronization, session playhead, seek authority (`requestSeek`), active participant, and cross-media coordination.
- Timeline remains a domain addressing model, not the playback clock.

Owning architectural floor: `media-runtime-certified-floor-v1`.

Engineering rule: changes to Media Runtime ownership boundaries require a new architecture certification against this floor. Do not reopen PlaybackCoordinator / FilmRoomSessionCoordinator ownership without repository evidence and a certified amendment.

---

## 8. Shared Match Media Architecture

Status

CERTIFIED — architecture and contracts only

Version

v1

Certification Date

2026-07-20

Confidence

High

Repository References

- docs/architecture/certification/SharedMatchMedia-ArchitectureDecision-v1.md
- docs/architecture/certification/SharedMatchMedia-CertifiedBoundaries-v1.md
- docs/architecture/certification/SharedMatchMedia-ServiceContracts-v1.md

Certification Summary

Parent Competition owns canonical Match attachment authority. Shared Match Media owns immutable binary identity, verification, storage identity, delivery metadata, and lifecycle. Coach receives a read-only projection; device caches are disposable and non-authoritative.

Media Resolution rechecks current authorization and passes only a short-lived, range-capable playable URI into Film Room. Local paths, object keys, and signed delivery URLs never enter synchronized state.

PlaybackCoordinator and FilmRoomSessionCoordinator ownership remain unchanged and protected. This entry certifies architecture and contracts; it does not certify production functionality or authorize implementation before Required Proof and privacy approval.

Service ownership is certified across Upload, Verification, Publication, Resolution, Storage, and Projection. Each durable transition and failure-recovery path has one owner. Service orchestration, retry, delivery, and measurement do not transfer playback or synchronization authority.

Isolated Verification runtime is certified through 10 GiB. The evidence confirms immutable R2 validation, streaming SHA-256, exact bytes/MIME, bounded memory, single admission, terminal evidence, and release. Primary architecture status remains CERTIFIED — architecture and contracts only. Production functionality remains uncertified.

---

# Master Certification Table

| Architecture Area | Status | Confidence |
|-------------------|--------|------------|
| Canonical Identity Ownership | CERTIFIED | High |
| Competition Topology Ownership | PARTIALLY CERTIFIED | High |
| Coach Artifact Pipeline | PARTIALLY CERTIFIED | High |
| Overlay Merge Contract | CERTIFIED | High |
| Competition Rendering Pipeline | PARTIALLY CERTIFIED | High |
| Product Architecture | CERTIFIED | High |
| Media Runtime Foundation | CERTIFIED | High |
| Shared Match Media Architecture (contracts only) | CERTIFIED | High |

---

# Founder Velocity Note

This register is intentionally incremental.

Only architecture that has already been certified is included.

Additional sections will be added as they are certified.

---

## Change Policy

This register may only be updated when one of the following exists:

- repository certification
- runtime certification
- QA certification
- engineering investigation
- architecture review

Do not modify certification based on assumptions.
