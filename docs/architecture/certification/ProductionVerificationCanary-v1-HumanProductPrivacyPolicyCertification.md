# Human Product/Privacy Policy Certification
Production Verification Canary v1

Verdict: **APPROVED WITH CONDITIONS**

Approval date: 2026-07-23

Expiry datetime: 2026-07-30T00:00:00-07:00

Product/Privacy owner and audit owner: Israel Ortiz Soto

Certified engineering floor: `38b894338db1868948c7b83fe4caa70c16b8f434`

Confirmed authorization expiry (eliminates date-only ambiguity):

- Israel Ortiz Soto explicitly confirmed: Production Verification Canary v1 policy authorization expires at 2026-07-30T00:00:00-07:00.
- Fail-closed instant: `2026-07-30T00:00:00-07:00` (not end-of-day `2026-07-30`).

---

## Certified policy values

The Product/Privacy owner approves the bounded use of:

- `scanHookStatus: "scan_not_required"`
- `scanPolicyIdentity: "first-slice-scan-not-required-v1"`

This is a narrow, one-time exception for Production Verification Canary v1. It does not authorize scanner-free handling of ordinary user, athlete, customer, or competition media.

`scan_not_required` is acceptable only because the single canary asset must be trusted, controlled, deliberately staged, consented, non-sensitive, and reviewed before use.

## Permitted media

The certification permits exactly one controlled test clip that:

- is deliberately staged or synthetic;
- is supplied or explicitly approved by Israel Ortiz Soto;
- depicts adults only;
- is non-sensitive;
- is not real match or competition footage;
- is not an ordinary user or customer upload;
- is not captured in a private setting;
- includes only people who have consented to its use;
- contains no names, voices, recognizable faces, academy branding, embedded metadata, or other identifying information unless technically unavoidable and explicitly documented before authorization.

## Prohibited media

The following media is prohibited:

- any depiction of a minor;
- real athlete, user, or customer uploads;
- live customer or production-user data;
- real match or competition footage;
- private or confidential content;
- medical, biometric, intimate, or otherwise sensitive information;
- unauthorized third-party footage;
- copyrighted media without permission;
- footage obtained without the consent of every depicted person;
- content containing unnecessary personal identifiers;
- any asset whose provenance, consent, or adult-only status cannot be established.

## Exact canary scope

This certification is limited to:

- one immutable canary asset;
- one pre-recorded asset identity;
- one pre-recorded object version;
- one pre-recorded cryptographic hash;
- one Production Verification Canary v1 execution;
- one verification attempt against the certified engineering floor.

The asset may not be reused. The authorization may not be expanded to additional assets, retries, users, workflows, environments, or general production traffic.

This certification creates no general policy precedent.

## Expiry and automatic invalidation

The certification expires at the earliest of:

- successful completion of the authorized canary;
- abortion of the authorized canary;
- `2026-07-30T00:00:00-07:00`;
- any change to engineering floor `38b894338db1868948c7b83fe4caa70c16b8f434`;
- any change to the asset, asset identity, object version, or hash;
- any change to `scanHookStatus` or `scanPolicyIdentity`;
- any change to the processing path;
- any relevant change to vendor or Cloudflare configuration.

Any invalidation requires a new human Product/Privacy decision before another canary can be considered.

## Mandatory abort conditions

The canary must be aborted immediately if:

- the asset identity, object version, or hash differs from the authorized value;
- a minor appears;
- an unauthorized person appears;
- prohibited media or information is discovered;
- an unauthorized or unnecessary identifier appears;
- asset provenance or consent cannot be verified;
- execution exceeds the single-canary boundary;
- the scope expands in any way;
- the policy or runtime values differ from the certified values;
- logs expose media, frames, transcripts, or sensitive information;
- unexpected processing, copying, or replication occurs;
- required deletion cannot be completed and verified;
- any required evidence is absent, incomplete, inconsistent, or untrustworthy.

An aborted canary may not be retried under this certification.

## Retention and deletion requirements

Within 24 hours after successful completion or abort:

- delete the canary media object;
- delete all unnecessary copies;
- verify and document deletion;
- do not retain media bytes, extracted frames, transcripts, face imagery, or unnecessary personal data.

A redacted audit record may be retained for 30 days. It must contain no canary media and no unnecessary personal information.

After 30 days, the redacted audit record must be deleted unless a separately documented legal or incident-preservation requirement applies.

## Required evidence

The audit record must contain:

- approval timestamp;
- approver identity;
- verdict;
- certified policy values;
- certified engineering commit;
- asset provenance statement;
- consent statement;
- adult-only attestation;
- non-sensitive-media attestation;
- immutable asset identity;
- immutable object version;
- cryptographic hash;
- execution start and end timestamps;
- terminal outcome;
- abort review, if applicable;
- deletion timestamp and confirmation;
- location or identity of the redacted audit record.

Missing evidence triggers immediate abort and invalidates the certification.

## Authorization boundary

This certification resolves only the human Product/Privacy policy gate for the narrowly defined canary.

It does not authorize:

- deployment or pushing code;
- tagging or releasing;
- Cloudflare configuration or resource mutation;
- secret provisioning;
- insertion of canary identities;
- changing the verification flag from `"0"`;
- enabling Production Verification;
- uploading media;
- executing the production canary.

Deployment/provisioning and single-canary execution remain separate missions requiring separate authorization.
