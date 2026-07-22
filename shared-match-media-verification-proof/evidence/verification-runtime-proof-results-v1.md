# Shared Match Media Verification Runtime Proof v1

Date: 2026-07-21

## Conclusion

**REJECTED: Container verification failed at the 1 GiB rung and did not
satisfy the certified 20 GiB contract.**

The isolated Container topology was deployed on 2026-07-21. The retained,
independently hashed 1 GiB object was admitted, but each of the three
`invoke-container-verifier` attempts returned the same nonterminal response:
`Error: container returned nonterminal response 503`. No attempt produced
executor-terminal evidence, a byte count, a digest, MIME evidence, or EOF
evidence. The Workflow therefore did not execute its release step and ended
errored. In accordance with the hard-stop rule, the proof was disabled and the
5/10/20 GiB rungs were not run.

This result does not assign a root cause that Cloudflare did not expose. It
certifies only the observed result: this deployed topology did not complete the
1 GiB contract and therefore cannot be certified for 20 GiB.

## Container runtime hard-stop evidence

### Deployed topology

- Worker version deployed disabled: `ba2ee1a5-aa08-4b4a-8211-1df6dd06530b`
- Worker version deployed enabled: `9e0e4b54-5d14-44ec-9a9e-6f5e42645041`
- Worker version restored disabled: `e8383d18-2131-4628-900b-54e6b2d11770`
- Container application: `a038ee2d-e06f-4831-bcea-c6874f9fc684`
- Container image: `sha256:d981681964d2bbbb168f0de8b5e2b4f7c3c646805941207f6e07416ed7a53a1e`
- Container class: `standard-1` (`0.5` vCPU, `4 GiB` memory, `8 GB` disk)
- Container network: private, no assigned IPv4 or IPv6
- Container SSH: disabled
- Container maximum instances: `1`
- Container instance observed: `f850e5803cf6bfe7e26d9fc37bc7008e9cbf1d631754109ceb95441670123299`
- Admission Durable Object namespace: `d8715f3ee4224cd5918cbc67d9bbac04`
- Workflow execution version: `d921c09e-2fc2-47d3-b17c-3b24e8b68768`

The deployed binding manifest contained only `PROOF_ADMISSION`,
`PROOF_CONTAINER`, `VERIFICATION_PROOF`, and the
`matmind-shared-media-verification-proof` R2 bucket. The production bucket
`matmind-coach-media` was absent.

### Sequential Container ladder

| Rung | Object bytes | Independent SHA-256 | Immutable R2 version | Upload | Workflow result | Container result | Admission release |
|---:|---:|---|---|---:|---|---|---|
| 1 GiB | 1,073,741,824 | `74ead4979e013f981cf2c7b6eae53f4edf6fc626bf858f8c51b81327ae1af574` | `7e60793e18a8b5f612df1ff5e4edbf8a` | Existing retained object; original upload 83,870 ms | Errored after 13 seconds | Three nonterminal `503` responses; no terminal output | Not attempted; admission remained held |
| 5 GiB | 5,368,709,120 | `1de4231789c9191a7ef8b85f7f73023274a598fbcfca731bb73af71dccae2636` | `7e60793b1927b617ed1a44fb54b11afa` | Existing retained object; not read | Not run after hard stop | Not run | Not applicable |
| 10 GiB | Not created | — | — | Not uploaded | Not run | Not run | Not applicable |
| 20 GiB | Not created | — | — | Not uploaded | Not run | Not run | Not applicable |

The 1 GiB Workflow identity was
`proof-0be85e9a2f11a3b1877edf3d540714cb71fb3fc9da11190849752edc2a35ac3e`.
Its admission step completed in one second with
`{"outcome":"admitted","idempotent":false}`. Container invocation ran from
17:37:08 through 17:37:20 America/Los_Angeles. Its attempts failed after two
seconds, zero seconds, and zero seconds respectively. Each attempt returned the
same recorded error and persisted `Output: null`.

### Admission-control runtime evidence

- The distinct proof identity
  `proof-ecf83b4c04a538c2a7c65cb330a2dd184d480830b0a9a5adeb7de68d580c1d0e`
  requested admission after the first Workflow errored without terminal
  executor evidence.
- Admission returned `busy` and identified the original 1 GiB proof as owner.
- The competing Workflow ended immediately with
  `ProofFailure: another verification runtime owns admission` and contained no
  Container invocation step.
- A duplicate trigger converged on the original deterministic Workflow identity
  and returned `duplicate:true`; it did not create a second Workflow. It was
  observed after that Workflow had already errored, so no claim is made that
  this particular duplicate was submitted during active hashing.
- Missing/nonterminal evidence remained fail closed in the deployed runtime:
  the original admission was still held after all Container attempts failed.
- Wrong-identity and malformed-evidence release rejection passed the local
  protocol suite. They were not directly invoked against deployed state because
  the architecture intentionally exposes no HTTP or operator mutation path to
  the Admission Durable Object, and the 1 GiB hard stop prohibited adding one.
- Terminal-evidence release was not exercised because the Container emitted no
  terminal evidence. No release-without-evidence occurred.

### Read, storage, and cost evidence

- No benchmark object was created or uploaded during the Container run.
- Existing completed proof storage remained 6 GiB under the three-day
  application lifecycle.
- Exact R2 bytes read by the failed Container attempts were not exposed. With
  three attempts against a 1 GiB immutable object, read exposure is unknown and
  bounded above by 3 GiB.
- No successful EOF or read-amplification measurement was produced.
- The Workflow exposed 13 seconds total duration and 12 seconds in the
  Container invocation step. Immediate billing data and exact Container CPU
  consumption were not exposed, so no fabricated charge is reported.
- The proof Worker was restored to `PROOF_ENABLED="0"` immediately after the
  hard stop. Completed objects remain under three-day retention; incomplete
  multipart uploads remain under Cloudflare's provider-managed seven-day rule.

## Prior Worker runtime conclusion

**Container hashing was required by the prior Worker proof.**

The exact Worker/Workflow path passed at 1 GiB but failed all three attempts at
5 GiB with the authoritative Cloudflare outcome `Worker exceeded memory limit`.
Because the certified contract requires 20 GiB, a path that cannot complete
5 GiB cannot be certified for 20 GiB. The 10 GiB and 20 GiB objects were not
created after this deterministic lower-bound rejection; doing so would incur
another 30 GiB of temporary storage and large repeated reads without changing
the architecture conclusion.

Workflow remains the orchestration owner. A Cloudflare Container must become
the hashing executor for the next proof.

## Isolation

- Account: `9014361709b3169cc261237c717ec0b6`
- Worker: `matmind-shared-media-verification-proof`
- Workflow: `matmind-shared-media-verification-proof-workflow`
- R2 bucket: `matmind-shared-media-verification-proof`
- Production bucket `matmind-coach-media`: never bound, read, or modified
- Wrangler: `4.112.0`
- Configured CPU ceiling: `300000` ms; accepted by deployment
- R2 retention: expire all objects after 3 days
- Workflow success/error retention: 3 days
- Concurrency used: 1

## Prior Worker data path exercised

```text
immutable R2 object
-> R2ObjectBody.body
-> byte-counting TransformStream
-> bounded 4 KiB MIME prefix capture
-> crypto.DigestStream("SHA-256")
-> EOF
-> byte/digest/MIME comparison
```

No multipart ETag, per-part digest combination, client-declared result, local
filesystem hash, or in-memory synthetic stream was used as runtime proof.

## Deterministic manifests

Both completed objects used a 24-byte ISO BMFF `ftyp/isom` prefix followed by
deterministic zero bytes. The control SHA-256 was computed locally before the
multipart upload began. R2 completion then supplied the immutable version.

| Size | Expected bytes | Independent SHA-256 | R2 version | Parts | Upload wall time |
|---:|---:|---|---|---:|---:|
| 1 GiB | 1,073,741,824 | `74ead4979e013f981cf2c7b6eae53f4edf6fc626bf858f8c51b81327ae1af574` | `7e60793e18a8b5f612df1ff5e4edbf8a` | 11 | 83,870 ms |
| 5 GiB | 5,368,709,120 | `1de4231789c9191a7ef8b85f7f73023274a598fbcfca731bb73af71dccae2636` | `7e60793b1927b617ed1a44fb54b11afa` | 52 | 424,222 ms |
| 10 GiB | Not created after 5 GiB rejection | — | — | — | — |
| 20 GiB | Not created after 5 GiB rejection | — | — | — | — |

## Prior Worker runtime results

| Size | Outcome | Attempts | Streamed bytes | Hash-step wall time | Observed total | CPU evidence |
|---:|---|---:|---:|---:|---:|---|
| 1 GiB | Passed | 1 | 1,073,741,824 | 39,983 ms | 50,894 ms | Completion proves below configured ceiling; exact CPU ms not exposed by instance status |
| 5 GiB | Rejected | 3 | No attempt reached EOF | 3m / 3m / 2m | 8m | Platform error on every attempt: `Worker exceeded memory limit` |
| 10 GiB | Not run; superseded by 5 GiB rejection | — | — | — | — | — |
| 20 GiB | Not run; superseded by 5 GiB rejection | — | — | — | — | — |

The 5 GiB attempt produced no digest, no byte-count success, and no false
terminal success. Cloudflare's instance report returned `Output: null`.

## Retry, duplicate, disconnect, and integrity controls

- Duplicate trigger: the same deterministic identity returned the already
  complete 1 GiB Workflow in 1,123 ms with `duplicate: true`; R2 was not reread.
- Client disconnect/lifetime: the original trigger returned accepted while the
  1 GiB Workflow continued for approximately 51 seconds and completed under
  independent Workflow ownership.
- Forced retry: attempt 1 was forced to fail after the configured 100 MiB
  threshold; attempt 2 restarted from byte zero, streamed the complete 1 GiB,
  and matched the independent SHA-256. Recorded amplification threshold:
  104,857,600 bytes.
- Natural retry: the 5 GiB memory failure caused three independent attempts.
  Partial digest state was not reused and the instance ended errored.
- Version mismatch: terminal Workflow error
  `ProofFailure: benchmark object version changed`.
- Missing object: terminal Workflow error
  `ProofFailure: benchmark object is missing`.
- R2 read failure: represented by the forced mid-stream failure; incomplete
  reads never emitted success evidence.
- Timeout/cancellation: the platform memory termination supplied the bounded
  resource-cancellation case. No attempt output was persisted.
- Public evidence redaction: status output contains a SHA-256 object-identity
  surrogate, not the R2 object key. Unauthorized requests receive `401`.

## Memory evidence

The implementation retains only:

- a 4 KiB prefix buffer,
- one incoming stream chunk,
- the native `DigestStream` state.

It never calls `arrayBuffer()`, `bytes()`, `blob()`, `text()`, or `json()` on
the R2 object body. Despite that bounded application design, Cloudflare
terminated all 5 GiB attempts for exceeding the Worker memory limit. That is
runtime evidence that this exact Worker path cannot satisfy the contract; the
proof does not speculate about internal platform buffering.

## Read amplification and cost evidence

- Stored completed objects: 6 GiB, retained for at most 3 days.
- Successful 1 GiB hash read: 1 GiB.
- Forced retry control: one partial read plus one complete 1 GiB reread.
- Failed 5 GiB hash: three attempts, each terminated before EOF. The platform
  did not expose exact bytes consumed per terminated attempt; total bytes are
  therefore intentionally reported as unknown, bounded above by 15 GiB.
- R2 Standard has no retrieval or egress fee. Storage list price at the time of
  proof was $0.015/GB-month; 6 GiB for 3 days is approximately $0.009 before
  account free tier and billing-unit rounding.
- Multipart creation/parts/completion and object reads are Class A/Class B
  operations respectively. The measured operation volume remains far beneath
  published monthly included operation quantities, subject to other account use.
- Workflow exact CPU consumption was not exposed by Wrangler instance status.
  No fabricated CPU estimate is recorded.

## Minimum Container proof contract

Workflow remains the durable orchestrator and supplies one request:

```text
{
  proofId,
  objectKey,
  objectVersion,
  expectedBytes,
  expectedSha256,
  expectedMime,
  harnessVersion
}
```

The Container must:

1. accept only a Workflow-authenticated internal invocation;
2. reread the exact immutable R2 version;
3. stream once through a native SHA-256 implementation and bounded MIME parser;
4. return bytes read, computed digest, detected MIME, wall time, executor version,
   attempt number, and a redacted object identity;
5. never write verification/publication/Match state;
6. use the same deterministic `proofId` for idempotency;
7. timeout at 30 minutes initially;
8. retry from byte zero, never from partial SHA-256 state;
9. return results to Workflow synchronously through its Container binding or by
   deterministic result polling if the invocation boundary cannot remain open.

Start the Container proof with `standard-1` (0.5 vCPU, 4 GiB memory) and
single concurrency. Escalate resource class only from measured evidence.

## Workflow-first admission amendment

The Container proof protocol creates or retrieves the deterministic Workflow
before any admission state can exist. The Workflow's first durable step calls
the singleton Admission Durable Object. Empty admission is acquired, the same
proof identity is idempotently re-admitted, and a different identity fails
before Container execution. The authenticated trigger has no admission binding
usage and cannot mutate the reservation.

Admission release is compare-by-identity and requires bounded, authoritative
terminal evidence emitted by `container-standard-1`. Workflow completion,
Workflow error, a missing Container response, and a nonterminal Container
response are not executor-terminal evidence and cannot release admission. This
is the certified fail-closed boundary: ambiguous execution blocks subsequent
proofs instead of admitting concurrent work.

## Cleanup

- Completed proof objects use the application-owned lifecycle
  `proof-retention-3-days`, enabled for all objects. Retention is 3 days and the
  boundary is certified.
- Incomplete multipart uploads use Cloudflare's provider-managed abort rule.
  Retention is 7 days; this is a certified platform boundary and is not an
  application lifecycle defect.
- Workflow instance retention is explicitly 3 days.
- Objects and instance evidence remain available for review until lifecycle expiry.
- Worker, Workflow, and bucket are isolated and may be deleted after evidence review.
