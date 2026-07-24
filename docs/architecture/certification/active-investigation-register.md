# MatMind Active Investigation Register

These systems intentionally remain uncertified.

## Shared Match Media Production Corridor

Status

FUTURE PROOF — NOT IMPLEMENTED

Current Understanding

Shared Match Media architecture, domain boundaries, and service responsibilities are certified in `SharedMatchMedia-ArchitectureDecision-v1.md`, `SharedMatchMedia-CertifiedBoundaries-v1.md`, and `SharedMatchMedia-ServiceContracts-v1.md`.

The Production Verification Service design contract and state machine are design-certified in `SharedMatchMedia-ProductionVerificationService-Contract-v1.md` as **DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED**. Parent Shared Match Media Upload remains Product Certified at the `upload_complete` boundary only. Production Verification remains unimplemented, undeployed, disabled, runtime-uncertified, and Product-uncertified.

The isolated verification Container runtime is certified through 10 GiB on the proof package. That evidence does not implement or certify the production Verification Service or the broader production corridor.

Human Product/Privacy Policy Certification for Production Verification Canary v1 is recorded in `ProductionVerificationCanary-v1-HumanProductPrivacyPolicyCertification.md` as **APPROVED WITH CONDITIONS** (2026-07-23; expires `2026-07-30T00:00:00-07:00`). That closes only the narrow canary privacy-policy gate for `scan_not_required` / `first-slice-scan-not-required-v1` against floor `38b894338db1868948c7b83fe4caa70c16b8f434`. It does not authorize deployment, flag enablement, media upload, canary execution, or general production privacy policy.

Unknown

Whether the proposed upload, verification, compare-and-swap publication, projection hydration, authorization, range delivery, revocation, deletion, scanner integration, general production privacy gates, and mobile background behavior satisfy every Required Proof and remaining privacy gate in production conditions. Required Proof #5 remains open for implementation and live production evidence despite design acceptance criteria being enumerated. Separately authorized deployment/provisioning and single-canary execution remain open.

20 GiB isolated capacity remains FUTURE CERTIFICATION — NOT STARTED and is not an active investigation.

Required Evidence

Complete the certified Required Proof and remaining general production privacy approvals before production certification. Preserve Canary v1 policy conditions if a separately authorized canary mission proceeds. Separately authorize any deployment/provisioning or single-canary execution mission and any 20 GiB capacity certification; do not extrapolate from the 10 GiB floor, design certification, or the narrow canary privacy approval alone.


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
