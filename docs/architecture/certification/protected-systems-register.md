# MatMind Protected Systems Register

> Systems that have sufficient repository and/or runtime certification to require evidence before modification.

| System | Repository Owner | Why Protected | Primary Evidence | Safe To Modify? | Certification |
|----------|------------------|---------------|------------------|-----------------|---------------|
| Canonical Identity Ownership | Identity | Core identity authority for athlete reconciliation | docs/canonical-athlete-authority-spec.md | Only with repository evidence | CERTIFIED |
| Overlay Merge Contract | Overlay Runtime | Defines ownership of overlay annotations and merge behavior | docs/overlay-architecture-v1.md | No direct modification without certification | CERTIFIED |
| Competition Rendering Pipeline | Competition Runtime | Rendering lifecycle has undergone extensive repository/runtime certification | Runtime dependency audits, REG investigations | Modify only with bounded investigation | PARTIALLY CERTIFIED |
| Competition Topology | Competition Runtime | Runtime ownership and topology governance established | competition-runtime-governance-v1.md | Only through certified ownership boundaries | PARTIALLY CERTIFIED |
| Coach Artifact Pipeline | Coach Runtime | Authoring → hydration path largely certified | hydration-orchestration-v1.md | Parent publication/runtime remains under investigation | PARTIALLY CERTIFIED |
