# MatMind Protected Systems Register

> Systems that have sufficient repository and/or runtime certification to require evidence before modification.

| System | Repository Owner | Why Protected | Primary Evidence | Safe To Modify? | Certification |
|----------|------------------|---------------|------------------|-----------------|---------------|
| Canonical Identity Ownership | Identity | Core identity authority for athlete reconciliation | docs/canonical-athlete-authority-spec.md | Only with repository evidence | CERTIFIED |
| Overlay Merge Contract | Overlay Runtime | Defines ownership of overlay annotations and merge behavior | docs/overlay-architecture-v1.md | No direct modification without certification | CERTIFIED |
| Competition Rendering Pipeline | Competition Runtime | Rendering lifecycle has undergone extensive repository/runtime certification | Runtime dependency audits, REG investigations | Modify only with bounded investigation | PARTIALLY CERTIFIED |
| Competition Topology | Competition Runtime | Runtime ownership and topology governance established | competition-runtime-governance-v1.md | Only through certified ownership boundaries | PARTIALLY CERTIFIED |
| Coach Artifact Pipeline | Coach Runtime | Authoring → hydration path largely certified | hydration-orchestration-v1.md | Parent publication/runtime remains under investigation | PARTIALLY CERTIFIED |
| Parent Competition Match Media Attachment Authority | Parent Competition | Owns active attachment, revision, replacement, and tombstone | SharedMatchMedia-ArchitectureDecision-v1.md; SharedMatchMedia-CertifiedBoundaries-v1.md | Only through new certification | CERTIFIED — contracts only |
| Shared Match Media Binary Authority | Shared Match Media | Owns binary identity, verification, storage identity, delivery metadata, and lifecycle | SharedMatchMedia-ArchitectureDecision-v1.md | Implementation requires Required Proof and privacy approval | CERTIFIED — contracts only |
| Coach Match Media Projection | Coach Hydration | Read-only projection of Parent-owned attachment truth | SharedMatchMedia-CertifiedBoundaries-v1.md | No Coach mutation authority | CERTIFIED — contracts only |
| Match Media Resolution Boundary | Shared Match Media Delivery | Rechecks authorization and yields ephemeral range-capable URI | SharedMatchMedia-CertifiedBoundaries-v1.md | No object keys or signed URLs in sync state | CERTIFIED — contracts only |
| Film Room Resolved-URI Consumer Boundary | Film Room Product | Consumes an already-authorized playable URI only | SharedMatchMedia-CertifiedBoundaries-v1.md | Cannot own authorization, publication, or synchronization | CERTIFIED — contracts only |
| PlaybackCoordinator Authority | Media Runtime | Field playback authority remains unchanged by Shared Match Media | MediaRuntimeFoundation-v1-Certification.md; SharedMatchMedia-CertifiedBoundaries-v1.md | Ownership changes require new certification | CERTIFIED |
| FilmRoomSessionCoordinator Authority | Media Runtime | Session synchronization authority remains unchanged by Shared Match Media | MediaRuntimeFoundation-v1-Certification.md; SharedMatchMedia-CertifiedBoundaries-v1.md | Ownership changes require new certification | CERTIFIED |
| Shared Match Media Service Ownership | Shared Match Media Services | Separates Upload, Verification, Publication, Resolution, Storage, and Projection authority with single-owner recovery | SharedMatchMedia-ServiceContracts-v1.md | Service ownership changes require new certification | CERTIFIED — contracts only |
