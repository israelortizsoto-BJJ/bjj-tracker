# Shared Match Media — Production Verification Skeleton

**Status:** disabled, unwired, runtime-not-implemented.

This package holds the durable verification-record and admission CAS skeleton required by
`docs/architecture/certification/SharedMatchMedia-ProductionVerificationService-Contract-v1.md`.

## Durable persistence boundary

Authoritative durability uses the repository-native **R2 JSON + ETag conditional-put**
pattern already established for Shared Match Media upload metadata in
`coach-sync-worker` (`onlyIf: { etagDoesNotMatch: "*" }` / `onlyIf: { etagMatches: etag }`).

- `createConditionalObjectVerificationRecordStore(objects)` adapts an injected
  `ConditionalObjectStore` capability into `VerificationRecordStore`.
- No `env.MEDIA` binding, wrangler change, route, worker, flag, or composition-root
  wiring is included.
- Local tests inject `createSyntheticConditionalObjectStore()` — a synthetic
  conditional-object backend that implements the same onlyIf ETag semantics for
  isolated proof. That synthetic backend is a test double for the injected
  capability, not a production binding and not an application-level admission queue.

## Not

- the isolated proof package (`shared-match-media-verification-proof/`);
- a worker, route, queue, scheduler, or event subscriber;
- wired to upload completion or any production runtime entry point;
- authorized for flag enablement, deployment, binary verification, or production object access.

Do not import this package from `coach-sync-worker`, Expo app routes, or upload completion paths
until a separately authorized wiring mission exists.
