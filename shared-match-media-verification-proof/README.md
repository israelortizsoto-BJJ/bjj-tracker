# Shared Match Media Verification Runtime Proof

This package is an isolated, non-production benchmark. It owns no Match,
attachment, publication, projection, playback, Session, transcript, or coach
runtime state.

The deployed proof path is:

`R2 body -> bounded prefix/counting TransformStream -> crypto.DigestStream("SHA-256")`

The default feature flag is disabled. The deployed proof environment requires
`PROOF_TRIGGER_SECRET`, accepts only `benchmarks/` object keys, hashes object
identities before returning evidence, uses deterministic Workflow instance IDs,
and retains Workflow state for three days.

Measured conclusion: the exact Worker path passed at 1 GiB and exceeded the
Worker memory limit on all three 5 GiB attempts. See
`evidence/verification-runtime-proof-results-v1.md`. Container hashing is
required for the certified 20 GiB ceiling; Workflow remains the orchestrator.
