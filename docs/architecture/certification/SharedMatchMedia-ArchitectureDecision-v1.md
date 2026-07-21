# Shared Match Media — Architecture Decision v1

Engineering tag: `shared-match-media-architecture-certification-v1`

Version: v1, derived from the approved V3 final candidate

Decision status: **CERTIFIED — Shared Match Media Architecture v1 (architecture and contracts only)**

Implementation authorization: **CONDITIONAL — Required Proof and privacy-policy approval remain mandatory before production implementation.**

Scope: documentation and architecture only; no production implementation.

## Certification Basis

This certified artifact preserves the approved V3 candidate's normative invariants, transaction boundaries, Match-scoped authorization, compare-and-swap publication, upload lifecycle, revocation behavior, migration controls, privacy gates, and Required Proof. Certification establishes the architecture and contracts; it does not certify production functionality.

## Executive Summary

MatMind should solve shared Match video as an attachment-and-delivery problem, not as playback synchronization or Coach-owned media. In v1, a Parent-controlled Match has at most one canonical video attachment. Shared Match Media creates immutable binary identities, verifies uploads, and produces authorized short-lived delivery URIs. Coach receives a read-only, revisioned projection and device-local cache state. Film Room receives a resolved URI.

This is the smallest credible Parent→Coach breakdown slice because it crosses the only boundary the current local model cannot cross: a Parent device’s persisted `file://` video cannot become Coach-accessible by topology projection alone. The design preserves the certified PlaybackCoordinator and Session boundaries.

## Problem Statement

Current Parent competition detail stores video as `videoUri` and `videoAssetId`. Topology construction projects these as `parentMediaRefs`. This works as local evidence but does not establish durable binary identity, upload verification, authorized Coach delivery, replacement ordering, or deletion semantics. A local URI is device-scoped and must never be treated as synchronization data.

The product outcome is: a Parent attaches one Match video; upload may resume; after verification the Parent publishes it atomically; a linked Coach sees the latest attachment and streams it in Film Room. Parent remains useful offline and the Coach cannot modify canonical Match media.

## Decision and Normative Invariants

1. A Match has zero or one active canonical video attachment in v1.
2. Match attachment authority is Parent Competition authority.
3. Binary identity and delivery are Shared Match Media authority.
4. Upload and publication are separate transactions; verification never implicitly publishes.
5. Only a verified asset bound to the same athlete/competition/Match context may be published.
6. Attachment mutations advance a monotonic revision and require compare-and-swap.
7. Coach state is a read-only projection. Coach cache state is device-local and non-authoritative.
8. Asset IDs, local URIs, object keys, and resolved URLs are distinct concepts.
9. Neither `file://` URIs nor short-lived resolved URLs enter synchronized domain artifacts.
10. Tombstone publication precedes delayed blob deletion.
11. PlaybackCoordinator and Session ownership do not change.
12. Film Room consumes a resolved URI; it does not resolve ownership or publication conflicts.

## Canonical Declaration

Canonical owner:

Parent Competition authority controls the canonical Match attachment.

Shared Match Media controls binary identity and delivery.

Overlay scope:

Coach receives a read-only attachment projection and device-local cache state.

Hydration trigger:

Session refresh,
topology revision,
foreground refresh,
explicit retry.

Reconcile direction:

Parent attachment revision
→ Coach read model

Publication direction:

Parent upload verification
→ Match attachment publication
→ Coach hydration

## Domain Model

### Match

Canonical identity is the existing Parent topology tuple `sharedAthleteId`, `sharedCompetitionId`, and `matchLineageKey`. Local entry IDs and ordinal-only addressing are not publication keys.

### MatchMediaAsset

Immutable record containing `matchMediaAssetId`, bound domain context, creator authority, status, storage object identity, detected MIME, byte count, checksum, timestamps, and deletion eligibility. An asset is not the Match attachment. Verified orphan assets may exist temporarily.

### MatchMediaAttachment

Parent Competition record containing Match identity, `revision`, `state: attached | tombstoned`, optional `matchMediaAssetId`, and publication metadata. Replacement points the next revision at a new verified asset. Tombstone has no active asset.

### CoachMatchMediaProjection

Read-only copy of Match identity, attachment revision/state, asset ID, safe content metadata, and publication time. It never contains writer credentials, object key, local URI, or resolved delivery URI.

### DeviceMediaCacheState

Coach-local state such as `absent | resolving | ready | stale | failed`, URI expiry, cached-file reference, retry metadata, and last-seen attachment revision. It is disposable and never reconciles back to Parent.

## Canonical Ownership and Ownership Matrix

| Concern | Canonical owner | Consumers | Forbidden authority |
|---|---|---|---|
| Match identity/topology | Parent Competition | Sync, Coach projection | Shared Media cannot create Matches |
| Active attachment/revision/tombstone | Parent Competition | Shared Media validation, Coach | Coach cannot mutate |
| Binary ID/checksum/object/rendition | Shared Match Media | Parent publication, delivery | Match store cannot invent verified status |
| Coach attachment read model | Hydration/projection layer | Coach UI | Cache cannot overwrite it |
| Resolved URI and bytes | Shared Match Media + device cache | Film Room | Sync artifacts cannot persist URI |
| Playback execution | PlaybackCoordinator | Film Room | Shared Media does not control clock |
| Cross-media synchronization | Session | Film Room | Attachment revision does not seek/play |

## Permission Matrix

| Capability | Parent writer for Match | Linked Coach reader | Revoked/unlinked Coach | Unauthenticated |
|---|---:|---:|---:|---:|
| Create/resume/complete upload | Allow | Deny | Deny | Deny |
| Publish/replace/tombstone | Allow | Deny | Deny | Deny |
| Read attachment projection | Allow | Allow | Deny | Deny |
| Resolve/stream current asset | Allow | Allow | Deny | Deny |
| Resolve superseded/tombstoned asset | Policy/admin only | Deny | Deny | Deny |
| Change device cache | Local | Local | Local purge | N/A |

Authorization is evaluated from authenticated relationship and Match context on every operation. Possession of a link token, asset ID, upload session, or previously issued URI is not durable authorization. Not-found responses should be opaque where needed to prevent enumeration.

## Upload State Machine

Asset states:

```text
initiated → uploading ↔ paused
                  ↓
               uploaded → verifying → verified
                    ↘          ↘
                     failed     rejected

verified or orphaned → deletion_eligible → deleted
```

Rules:

- Create is idempotent by Parent + Match + client idempotency key.
- Chunks/parts are retryable and integrity-addressed; concurrent upload sessions cannot publish over one another without the Match revision precondition.
- Complete is idempotent and validates byte count, checksum, detected MIME, and policy.
- `verified` means eligible, not attached.
- A failed/rejected asset cannot publish.
- Abandoned and verified-orphan assets are collected only after the configured grace period.

Attachment states:

```text
absent → attached(r1) → attached(r2...) → tombstoned(rN)
             └──────── replacement ────────┘
```

Publication is atomic: validate Parent authority, exact Match binding, asset verified state, and `expectedRevision`; then advance revision and emit the topology/projection change. A conflict returns the current revision without partially changing attachment state.

## API Contracts

The exact transport may reuse the existing Worker/R2 service, but the Match-video domain contract must remain distinct from coach commentary.

### Create resumable upload

`POST /v1/competitions/{sharedCompetitionId}/matches/{matchLineageKey}/media-uploads`

Request: `sharedAthleteId`, declared MIME/bytes/checksum, optional filename, idempotency key, and cellular-policy-neutral client metadata. Response: `matchMediaAssetId`, upload session/protocol data, part constraints, expiry. Server binds the asset to authenticated Parent and exact Match.

### Inspect/resume upload

`GET /.../media-uploads/{matchMediaAssetId}` returns acknowledged parts/range, expiry, and state. Chunk transport may be provider-specific but must support safe repeat and must not grant publication authority.

### Complete and verify

`POST /.../media-uploads/{matchMediaAssetId}/complete` with idempotency key and final integrity data. Response is `verifying`, `verified`, or `rejected`; never attachment publication.

### Publish or replace

`PUT /v1/competitions/{sharedCompetitionId}/matches/{matchLineageKey}/media-attachment`

Request: `sharedAthleteId`, `matchMediaAssetId`, `expectedRevision`, idempotency key. Response: the new attachment projection. `409` includes current safe revision/state for reconciliation.

### Tombstone

`DELETE /.../media-attachment` with `expectedRevision` and idempotency key. Response is the tombstoned next revision. Physical deletion is asynchronous and delayed.

### Read and resolve

`GET /.../media-attachment` returns one attachment projection or absence. `POST /v1/match-media/assets/{matchMediaAssetId}/resolve` rechecks Match access and current attachment state, then returns an ephemeral stream URI, expiry, detected MIME/bytes, and range capability. Resolved URLs are never logged or persisted in synchronized state.

### Error and retry contract

`400` invalid; `401` unauthenticated; `403` unauthorized; opaque `404`; `409` revision/state conflict; `410` expired upload session where useful; `413` too large; `415` unsupported; `422` verification rejected; `429` retry-after; `5xx` retryable. All mutation retries use the same idempotency key.

## Threat Model

| Threat | Required control |
|---|---|
| ID enumeration/cross-athlete access | Random IDs plus relationship- and Match-scoped authorization |
| Stolen upload capability | Short expiry, exact asset/session binding, no publication grant |
| Replayed/stale mutation | Idempotency plus expected revision |
| MIME spoof, malicious/oversized binary | Server detection, checksum, size/quota enforcement, policy scanning |
| Object path manipulation | Server-generated object keys; never client-controlled paths |
| Signed URI leakage | Short TTL, redaction, TLS, no sync persistence; consider audience binding where supported |
| Coach access after unlink | Immediate denial of new resolve/hydration; short existing-URL TTL; local cache purge policy |
| Delete/replace race | Tombstone/replacement revision first; asynchronous delayed GC |
| Availability/cost abuse | Rate/byte quotas, resumable limits, audit/alerts |

## Privacy Review

Competition video of a child is sensitive user content. Before production, accountable product/privacy owners must approve: retention and recovery windows; deletion SLA; parent export/delete behavior; Coach unlink behavior including local cache; lawful basis/consent and age-related obligations; geographic storage/processing; support/admin access; incident logging; and whether malware/content scanning is required. Logs may include asset ID, Match lineage, state, byte count, and timing, but never credentials, signed URIs, local paths, or content-derived transcript/image data unless separately approved.

Privacy certification remains conditional until those policy values are named. Architecture certification does not itself approve retention.

## Migration Plan

1. Add optional `matchMediaAssetId`, attachment revision/state, and tombstone fields to Parent topology/sync types. Old readers ignore them; new readers tolerate absence.
2. Add Shared Match Media upload/verify/resolve behind independent server flags. No existing Match data changes.
3. Add Parent upload orchestration behind a client flag. Parent remains local-first and continues to render `videoUri`; cellular upload is configurable.
4. Add explicit publication after verification. Never infer cloud identity from current `videoAssetId` and never upload or sync `file://` as a delivery address.
5. Hydrate the read-only Coach projection on session refresh, topology revision, foreground refresh, and explicit retry.
6. Resolve only when Film Room needs the asset; pass the resolved URI to Film Room. Coach streams in v1.
7. Observe upload success, verification rejection, publication conflict, hydration lag, resolve denial/error, playback start, tombstone propagation, and orphan volume before widening rollout.

No bulk backfill is required. Existing videos remain Parent-local until an authorized Parent upload occurs.

## Rollback Plan

Use separate flags for upload creation, completion/verification, publication, projection emission, Coach hydration, and resolve. Roll back Coach first by disabling hydration/resolve and showing video unavailable; existing Parent local playback remains. Disable new publication next while allowing in-flight uploads to settle or expire. Do not rewrite revisions, resurrect tombstones, repoint Matches, or immediately delete blobs. Preserve attachment metadata and verified binaries through the recovery window so a corrected reader can resume. Trigger rollback on authorization leakage, revision corruption, local Parent regression, material hydration fan-out, or playback/runtime boundary regression.

## Certification Impact Matrix

| Area | Change | Risk | Required evidence |
|---|---|---:|---|
| Competition Match schema | Add optional pointer/revision/tombstone | Medium | old/new codec matrix |
| Parent local store | Local-first retained | Low | offline/no-network tests |
| Topology publication | Add attachment revision projection | High | CAS/order/idempotency tests |
| Coach hydration | Read-only reconcile | Medium | trigger/stale/tombstone tests |
| Shared Media backend | Video upload, verify, resolve, GC | High | contract/security/load proof |
| Authorization | Parent write/Coach read | High | cross-user/athlete/Match denial |
| Film Room | Accept resolved URI | Low | integration and expiry retry |
| PlaybackCoordinator | No change | Protected | dependency/source regression proof |
| Session | No change | Protected | clock/ownership regression proof |
| Existing coach audio | Separate contract retained | Medium | no route/type collision |
| Privacy/deletion | New sensitive binary lifecycle | High | policy approval and deletion drill |

## Explicit Non-goals

- More than one canonical video per Match.
- Coach upload, replacement, deletion, or attachment editing.
- Collaborative media ownership.
- Synchronizing `file://`, content URIs, object keys, or resolved URLs.
- PlaybackCoordinator changes.
- Session changes.
- Film Room ownership of hydration/publication.
- Guaranteed Coach offline downloads or cross-device cache sync.
- Multi-angle video, highlights, clips, comments, markers, annotations, transcript changes, or waveform changes.
- A generalized media-library or arbitrary attachment framework.
- Immediate blob deletion.

## Required Proof

Certification cannot advance to implementation approval until evidence covers:

1. Repository-wide schema inventory confirms no existing canonical shared Match-video owner or incompatible `videoAssetId` meaning.
2. Old/new Parent and Coach payload decoding across absent, attached, replaced, and tombstoned states.
3. Parent-only write; Coach-only read; denial across user, athlete, competition, Match, revoked link, guessed ID, and superseded asset.
4. Resumable interruption/restart, duplicate parts, duplicate complete, upload expiry, and same-idempotency replay.
5. Verification for bytes, checksum, MIME, size, and rejected content; publication before verification denied.
6. CAS publication conflict, concurrent replacement, idempotent publication, atomic projection, and monotonic revision.
7. Tombstone beats stale attachment during out-of-order delivery; delayed GC never makes rollback destructive.
8. Resolve TTL, range/seek compatibility, expiry retry, revoked-access denial, and signed-URL log redaction.
9. Hydration on all four declared triggers with offline/stale/explicit-retry behavior and bounded fan-out.
10. Parent local-first and configurable cellular behavior, including background/interrupted upload UX.
11. Film Room receives only a resolved URI and handles unavailable/expired delivery without owning domain state.
12. No PlaybackCoordinator or Session changes; existing runtime and Film Room corridor suites remain green.
13. Privacy owner approval and a staging deletion/revocation drill.

## Assumptions and Invalidation Evidence

| Assumption | Risk | Evidence that would invalidate/change the decision |
|---|---:|---|
| One video is enough for v1 | Medium | Launch requirements demand multiple angles/clips |
| Parent is sole Match attachment writer | Medium | Repository/product authority grants Coach Match edits |
| Parent local-first is required | Low | Product explicitly makes cloud upload transactional with Match save |
| Coach streaming is acceptable | Medium | Offline use is launch-critical or bandwidth economics fail |
| Existing Worker/R2 pattern can host video | Medium | Platform limits, cost, compliance, or range support disprove it |
| Additive sync fields are compatible | Medium | Deployed clients reject unknown fields or schemas are closed |
| Film Room can accept resolved URI unchanged | Low | Player requires a new protocol/runtime ownership change |
| Short-lived URL is adequate revocation | High | Privacy policy requires immediate revocation of already-issued access |

## Future Expansion

After v1 proof: renditions/thumbnails and adaptive streaming; explicit Coach offline cache; multiple attachment slots; multi-angle selection; clip derivation; per-asset retention; analytics; admin safety workflow; content portability; and broader shared-media primitives. Each expansion must preserve Match attachment authority and may require a new certification if it changes cardinality, writer permissions, retention, or runtime ownership.

## Certification Questions

### Are we solving the right product problem?

Yes. The design makes the Parent’s canonical Match video available to the Coach for breakdown. It does not mistake local playback polish for cross-device media availability.

### Is this the smallest certification slice?

Yes. One attachment, one writer authority, streaming-only Coach, additive schema, and resolved-URI Film Room input are the minimum durable corridor. Resumability, verification, revisioning, and tombstones are not scope inflation; they are the minimum correctness controls for large sensitive binaries.

### Which assumptions remain risky?

Video size/format/range behavior, mobile background upload, Coach bandwidth, link revocation expectations, retention/deletion policy, and the one-video product constraint. These are certification gates, not silent implementation assumptions.

### What repository evidence could invalidate this?

Discovery of an existing cloud-canonical Match media system; proof that `videoAssetId` already has durable cross-device semantics; a second canonical Match writer; deployed schema intolerance; a requirement for Coach writes or multiple launch videos; or a Film Room protocol that forces protected runtime changes.

### Does this move MatMind toward scalable Parent→Coach breakdown?

Yes. Immutable binary assets plus Parent-owned revisioned attachment pointers let delivery, renditions, and caching scale independently from Competition truth. Coach remains a projection consumer, which prevents shared media from becoming a second Match authority.

## Proposed v1 Defaults

- one canonical video per Match
- Parent local-first
- Coach streams
- resumable upload
- configurable cellular upload
- read-only Coach
- attachment tombstone
- delayed blob deletion
- additive `matchMediaAssetId`
- no PlaybackCoordinator changes
- no Session changes
- no `file://` synchronization
- Film Room receives resolved URI

## Final Grade

| Dimension | Score |
|---|---:|
| Product clarity | 98 |
| Domain correctness | 97 |
| Ownership precision | 99 |
| Permission model | 97 |
| Migration safety | 97 |
| Runtime boundary protection | 100 |
| Testability | 98 |
| Implementation readiness | 96 |
| **Overall** | **98** |

## Certification Verdict

**CERTIFIED — Shared Match Media Architecture v1 (architecture and contracts only).**

The architecture is approved in principle for the stated v1 slice, conditional on the Required Proof—especially repository schema inventory, authorization tests, mobile upload evidence, range/expiry playback proof, and privacy retention/revocation approval. This document does not authorize production implementation by itself.
