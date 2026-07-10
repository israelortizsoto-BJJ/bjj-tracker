#!/usr/bin/env python3

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CERT_DIR = REPO_ROOT / "docs" / "architecture" / "certification"

FILES = {
    "CertifiedArchitectureRegister-v1.md": """# MatMind Certified Architecture Register v1

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

# Master Certification Table

| Architecture Area | Status | Confidence |
|-------------------|--------|------------|
| Canonical Identity Ownership | CERTIFIED | High |
| Competition Topology Ownership | PARTIALLY CERTIFIED | High |
| Coach Artifact Pipeline | PARTIALLY CERTIFIED | High |
| Overlay Merge Contract | CERTIFIED | High |
| Competition Rendering Pipeline | PARTIALLY CERTIFIED | High |

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
""",

    "CERTIFICATION_HISTORY.md": """# MatMind Certification History

## 2026-07-10

Initial Architecture Certification Register established.

Certified

- Canonical Identity Ownership
- Overlay Merge Contract

Partially Certified

- Competition Topology
- Coach Artifact Pipeline
- Competition Rendering Pipeline

Purpose

Provide a permanent engineering source of truth so future investigations begin from certified architecture rather than rediscovering previously proven systems.

Repository Baseline

a904db4
""",
    "protected-systems-register.md": """# MatMind Protected Systems Register

> Systems that have sufficient repository and/or runtime certification to require evidence before modification.

| System | Repository Owner | Why Protected | Primary Evidence | Safe To Modify? | Certification |
|----------|------------------|---------------|------------------|-----------------|---------------|
| Canonical Identity Ownership | Identity | Core identity authority for athlete reconciliation | docs/canonical-athlete-authority-spec.md | Only with repository evidence | CERTIFIED |
| Overlay Merge Contract | Overlay Runtime | Defines ownership of overlay annotations and merge behavior | docs/overlay-architecture-v1.md | No direct modification without certification | CERTIFIED |
| Competition Rendering Pipeline | Competition Runtime | Rendering lifecycle has undergone extensive repository/runtime certification | Runtime dependency audits, REG investigations | Modify only with bounded investigation | PARTIALLY CERTIFIED |
| Competition Topology | Competition Runtime | Runtime ownership and topology governance established | competition-runtime-governance-v1.md | Only through certified ownership boundaries | PARTIALLY CERTIFIED |
| Coach Artifact Pipeline | Coach Runtime | Authoring → hydration path largely certified | hydration-orchestration-v1.md | Parent publication/runtime remains under investigation | PARTIALLY CERTIFIED |
""",
    "active-investigation-register.md": """# MatMind Active Investigation Register

These systems intentionally remain uncertified.

## Parent Competition Runtime

Status

ACTIVE

Current Understanding

Competition rendering architecture has been substantially certified.

Unknown

Why Parent Compete can still display zero competitions after reverting to repository baseline.

Required Evidence

Repository evidence plus runtime certification.

---

## Parent Match Breakdown Publication

Status

ACTIVE

Current Understanding

Coach authoring and overlay merge are substantially certified.

Unknown

Why Match Breakdown is not consistently visible on Parent.

Required Evidence

Publication boundary certification.

---

## Runtime Persistence

Status

ACTIVE

Current Understanding

Repository rollback alone did not restore Parent runtime.

Unknown

What runtime state survives Metro restart or rebuild.

Required Evidence

Runtime lifecycle certification.
""",
}


def main() -> None:
    CERT_DIR.mkdir(parents=True, exist_ok=True)

    for name, content in FILES.items():
        path = CERT_DIR / name
        path.write_text(content)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
