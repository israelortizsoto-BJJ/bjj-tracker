# ODS-EOS Operational Doctrine

Engineering rules for building and operating ODS-EOS. These apply to all contributors and to the system itself.

## One Fact, One Place

A durable engineering fact exists in exactly one atomic record in the knowledge store. Containers reference facts by `id`; they do not embed them. Narrative fields on container records are not authoritative.

Session is a container. Decision, Investigation, Boundary, QA Run, Parking Lot Item, Doctrine, Insight, and Risk are atomic facts. See `05-knowledge-store-schema.md` for field definitions.

## Evidence Before Opinion

Decisions require observable evidence: logs, diffs, test output, or collected records. Investigations require evidence before a verdict. Boundaries close on evidence from supporting investigations and QA runs. QA runs require evidence when the result is `fail` or `partial`. Assertions without evidence are hypotheses until verified. Generated documents must cite their source data in the knowledge store.

## One Boundary at a Time

Implement, test, and close one architectural boundary before starting the next. Do not wire collectors and generators in the same change unless the boundary between them is already stable. Partial integrations across boundaries create untraceable failures.

## Architecture Before Implementation

Read `02-architecture-v1.md` before writing code. If implementation requires a change to the architecture, update the architecture document first, then implement. If implementation requires a new record type or field, update `05-knowledge-store-schema.md` first, then implement. Code that diverges from documented boundaries is technical debt from day one.

## Documentation Is Generated, Not Authored

Operational documents (EOD reports, morning briefs, recaps, handovers, and investigation reports) are produced by generators from the knowledge store. Do not hand-write these documents and backfill the store to match. Hand-authored markdown in `docs/` is migration input or non-authoritative reference until decomposed into store records. The store is authoritative; documents are views.

## Capture Discipline

Collectors create atomic records at capture time. When a session produces a decision, investigation, parking-lot item, risk, doctrine amendment, or insight, the collector writes the typed record first and links it from the Session by `id`.

Deferral, commitment, inquiry, risk, and planning intent must not be paraphrased into `Session.summary`. Collectors must not write prose blobs that duplicate atomic fact fields.

## Never Reopen a Closed Boundary Without Contradictory Evidence

A boundary is closed when it is implemented, tested, and documented. Reopening it—refactoring interfaces, changing store schemas, or altering generator contracts—requires contradictory evidence: a demonstrated failure that cannot be fixed within the existing boundary. Convenience is not evidence.

## Automation Reinforces Engineering Discipline

Automate repetitive, reliable operations: collection runs, document generation, store validation. Automation does not replace judgment; it removes manual steps that introduce inconsistency. If an automated step fails, fix the automation or the underlying data—do not bypass it manually.

## Minimize Manual Repository Operations Where Automation Is Reliable

Prefer scripted or CLI-driven workflows over ad-hoc file edits for store updates, document generation, and collector runs. Manual edits to generated markdown are exceptions that must be justified and reconciled on the next collection cycle. Manual edits to atomic records in the knowledge store are exceptions that must be justified and reconciled on the next collection cycle.

## Rejected Patterns

The following patterns violate this doctrine and must not be introduced:

- **Session summary as fact store** — embedding decisions, investigations, parking-lot items, risks, or planning intent in `Session.summary`.
- **Compound markdown as source of truth** — monolithic documents that mix investigations, boundary catalogs, evidence matrices, and QA protocols without corresponding atomic store records.
- **Knowledge Investment as a record type** — deliberate learning is represented as one or more Sessions linked to atomic outcomes (Doctrine, Insight, Investigation, Decision), not as a separate record class.
