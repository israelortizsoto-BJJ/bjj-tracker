# Shared Match Media Verification Runtime Proof

This package is an isolated, non-production benchmark. It owns no Match,
attachment, publication, projection, playback, Session, transcript, or coach
runtime state.

The isolated proof path is:

`R2 -> Workflow -> Container -> native streaming SHA-256 -> terminal evidence -> Workflow`

The default feature flag is disabled. The deployed proof environment requires
`PROOF_TRIGGER_SECRET`, accepts only `benchmarks/` object keys, hashes object
identities before returning evidence, uses deterministic Workflow instance IDs,
and retains Workflow state for three days.

## Certified admission state machine

Admission is Workflow-first, proof-scoped, and fail-closed:

```text
authenticated trigger
  -> create deterministic Workflow instance (or get the existing instance)
  -> return instance identity

Workflow first durable step
  -> singleton Admission DO acquire(proofId)
     empty                    -> admitted(proofId)
     same active proofId      -> admitted(proofId, idempotent=true)
     different active proofId -> busy; Container is not invoked
  -> admitted Workflow invokes the singleton Container
  -> Container proxy rechecks Admission DO ownership
  -> Container returns authoritative terminal executor evidence
  -> Workflow calls release(proofId, evidence)
  -> Admission DO validates identity and Container terminal evidence
  -> release
```

The trigger has no Admission DO dependency and cannot create, replace, or
release admission state. Therefore failure before deterministic Workflow
creation leaves no reservation, and every possible reservation was requested
by an already-existing Workflow instance. A lost admission response is safe:
the same Workflow identity retries to idempotent admission.

Release never uses Workflow status as executor evidence. Missing, nonterminal,
malformed, or wrong-identity Container evidence leaves the admission held.
This intentionally blocks other proofs after an ambiguous executor outcome.
Only evidence whose executor is `container-standard-1`, whose identity matches
the active proof, and whose terminal marker passes the bounded evidence schema
can release it. There is no dashboard, manual SQL, manual Durable Object, or
trigger-side recovery path.

Global verification concurrency is bounded three times: the singleton
Admission DO admits one proof identity, the configuration declares one
`standard-1` Container instance, and the Container process accepts one active
hash request. The Admission DO remains the concurrency authority; the other two
checks are defensive enforcement.

Cleanup ownership is split at the platform boundary:

- Completed proof objects: three-day retention, application owned, certified.
- Incomplete multipart uploads: seven-day retention, Cloudflare Platform owned,
  provider managed.

Measured conclusion from the prior proof: the exact Worker path passed at 1 GiB and exceeded the
Worker memory limit on all three 5 GiB attempts. See
`evidence/verification-runtime-proof-results-v1.md`. Container hashing is
required for the certified 20 GiB ceiling; Workflow remains the orchestrator.
This package is locally ready for the isolated Container benchmark, but this
change does not deploy or claim a 20 GiB Container certification.
