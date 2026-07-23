/**
 * Controlled integration harness for the first Production Verification vertical slice.
 *
 * Proves: Parent-shaped upload_complete → admit → inspect → terminal verified →
 * derived eligible publication view, plus fail-closed eligibility for absent /
 * rejected / failed / verifying / stuck — without production R2 or feature enablement.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  admitVerification,
  appendAttemptEvidence,
  getVerificationRecord,
  transitionVerificationTerminal,
  type VerificationAdmissionDependencies,
} from "./admitVerification.ts";
import { createConditionalObjectVerificationRecordStore } from "./conditionalObjectVerificationRecordStore.ts";
import { evaluateObjectIntegrity } from "./objectIntegrityPolicy.ts";
import { deriveVerifiedMediaPublicationEligibility } from "./publicationEligibility.ts";
import { PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING } from "./storageBucketBinding.ts";
import { createSyntheticConditionalObjectStore } from "./syntheticConditionalObjectStore.ts";
import { PRODUCTION_VERIFICATION_CONTRACT_VERSION } from "./admissionIdentity.ts";
import type { ProductionVerificationRecord } from "./verificationTypes.ts";

function ftypObject(brand = "isom", padTo = 64): Uint8Array {
  const bytes = new Uint8Array(padTo);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 32);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(brand.padEnd(4, " ").slice(0, 4)), 8);
  return bytes;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeDeps(nowIso = "2026-07-23T18:00:00.000Z"): VerificationAdmissionDependencies {
  let tick = 0;
  return {
    store: createConditionalObjectVerificationRecordStore(
      createSyntheticConditionalObjectStore(),
    ),
    now: () => new Date(Date.parse(nowIso) + tick++ * 1000),
    randomId: () => `harness-${tick}`,
  };
}

describe("controlled production verification integration harness", () => {
  it("upload_complete → verified → publicationEligible with evidence trail", async () => {
    const evidence: string[] = [];
    const deps = makeDeps();

    const competitionId = "competition_harness_1";
    const matchId = "match_harness_1";
    const matchLineageKey = "lineage_harness_1";
    const athleteId = "athlete_harness_1";
    const matchMediaAssetId = "mma_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const storageObjectKey = `match-media/assets/${matchMediaAssetId}/original`;
    const objectVersion = "r2-version-harness-1";
    const objectBytes = ftypObject("mp42", 128);
    const calculatedSha256 = sha256Hex(objectBytes);

    const parentShapedUploadComplete = {
      status: "upload_complete" as const,
      matchMediaAssetId,
      objectVersion,
      storageObjectKey,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      declaredByteCount: objectBytes.byteLength,
      declaredMimeType: "video/mp4",
      expectedWholeObjectSha256: calculatedSha256,
      uploadSessionId: "mmus_harness_1",
      athleteId,
      competitionId,
      matchId,
      matchLineageKey,
    };
    evidence.push("parent_upload_complete_fixture");

    const admission = await admitVerification(
      {
        contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
        storageBucketBinding: parentShapedUploadComplete.storageBucketBinding,
        matchMediaAssetId: parentShapedUploadComplete.matchMediaAssetId,
        objectVersion: parentShapedUploadComplete.objectVersion,
        storageObjectKey: parentShapedUploadComplete.storageObjectKey,
        declaredByteCount: parentShapedUploadComplete.declaredByteCount,
        declaredMimeType: parentShapedUploadComplete.declaredMimeType,
        expectedWholeObjectSha256: parentShapedUploadComplete.expectedWholeObjectSha256,
        uploadSessionId: parentShapedUploadComplete.uploadSessionId,
        athleteId: parentShapedUploadComplete.athleteId,
        competitionId: parentShapedUploadComplete.competitionId,
        matchId: parentShapedUploadComplete.matchId,
        matchLineageKey: parentShapedUploadComplete.matchLineageKey,
      },
      deps,
    );
    assert.equal(admission.outcome, "created");
    assert.equal(admission.record.state, "verifying");
    assert.equal(admission.record.storageBucketBinding, "MEDIA");
    evidence.push("verification_admitted_verifying");

    // R2-shaped object inspection: one full-stream digest + bounded MIME prefix.
    const integrity = evaluateObjectIntegrity({
      declaredMimeType: parentShapedUploadComplete.declaredMimeType,
      declaredByteCount: parentShapedUploadComplete.declaredByteCount,
      expectedWholeObjectSha256: parentShapedUploadComplete.expectedWholeObjectSha256,
      observedByteCount: objectBytes.byteLength,
      calculatedSha256,
      mimePrefix: objectBytes.subarray(0, Math.min(4096, objectBytes.byteLength)),
      r2ContentType: "application/octet-stream",
    });
    assert.equal(integrity.outcome, "pass");
    evidence.push("r2_shaped_object_inspected");

    await appendAttemptEvidence(
      {
        admissionKeyHash: admission.record.admissionKeyHash,
        event: {
          kind: "object_inspection",
          detail: {
            observedByteCount: objectBytes.byteLength,
            calculatedSha256,
            observedMimeType: "video/mp4",
            r2ContentType: "application/octet-stream",
          },
        },
      },
      deps,
    );
    evidence.push("authoritative_evidence_appended");

    const verified = await transitionVerificationTerminal(
      {
        admissionKeyHash: admission.record.admissionKeyHash,
        targetState: "verified",
        observedByteCount: objectBytes.byteLength,
        observedMimeType: "video/mp4",
        calculatedSha256,
        scanHookStatus: "scan_not_required",
        verifierRuntimeVersion: "controlled-integration-harness-v1",
      },
      deps,
    );
    assert.equal(verified.state, "verified");
    assert.equal(verified.calculatedSha256, calculatedSha256);
    assert.equal(verified.scanHookStatus, "scan_not_required");
    evidence.push("terminal_verified");

    const eligibility = await deriveVerifiedMediaPublicationEligibility(
      {
        contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
        storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
        matchMediaAssetId,
        objectVersion,
        storageObjectKey,
      },
      verified,
    );
    assert.equal(eligibility.presence, "present");
    assert.equal(eligibility.publicationEligible, true);
    evidence.push("derived_publication_eligible");

    assert.deepEqual(evidence, [
      "parent_upload_complete_fixture",
      "verification_admitted_verifying",
      "r2_shaped_object_inspected",
      "authoritative_evidence_appended",
      "terminal_verified",
      "derived_publication_eligible",
    ]);

    // Idempotent re-admit of completed identity.
    const again = await admitVerification(
      {
        contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
        storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
        matchMediaAssetId,
        objectVersion,
        storageObjectKey,
      },
      deps,
    );
    assert.equal(again.outcome, "idempotent");
    assert.equal(again.record.state, "verified");
  });

  it("fail-closed eligibility for missing, rejected, failed, verifying, and stuck", async () => {
    const baseAdmission = {
      contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      matchMediaAssetId: "mma_ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb",
      objectVersion: "v1",
      storageObjectKey: "match-media/assets/mma_ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb/original",
    };

    const missing = await deriveVerifiedMediaPublicationEligibility(baseAdmission, null);
    assert.equal(missing.publicationEligible, false);
    assert.equal(missing.presence, "absent");

    async function admitFresh(): Promise<{
      deps: VerificationAdmissionDependencies;
      record: ProductionVerificationRecord;
    }> {
      const deps = makeDeps();
      const created = await admitVerification(
        {
          ...baseAdmission,
          declaredByteCount: 32,
          declaredMimeType: "video/mp4",
          athleteId: "a",
          competitionId: "c",
          matchLineageKey: "m",
        },
        deps,
      );
      return { deps, record: created.record };
    }

    {
      const { record } = await admitFresh();
      const view = await deriveVerifiedMediaPublicationEligibility(baseAdmission, record);
      assert.equal(view.durableVerificationState, "verifying");
      assert.equal(view.publicationEligible, false);
    }

    {
      const { deps, record } = await admitFresh();
      const rejected = await transitionVerificationTerminal(
        {
          admissionKeyHash: record.admissionKeyHash,
          targetState: "rejected",
          terminalReasonCode: "BYTE_COUNT_MISMATCH",
        },
        deps,
      );
      const view = await deriveVerifiedMediaPublicationEligibility(baseAdmission, rejected);
      assert.equal(view.durableVerificationState, "rejected");
      assert.equal(view.publicationEligible, false);
    }

    {
      const { deps, record } = await admitFresh();
      const failed = await transitionVerificationTerminal(
        {
          admissionKeyHash: record.admissionKeyHash,
          targetState: "failed",
          terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION",
        },
        deps,
      );
      const view = await deriveVerifiedMediaPublicationEligibility(baseAdmission, failed);
      assert.equal(view.durableVerificationState, "failed");
      assert.equal(view.publicationEligible, false);
    }

    {
      const { record } = await admitFresh();
      const stuckNow = new Date(Date.parse(record.updatedAt) + 60 * 60 * 1000);
      const view = await deriveVerifiedMediaPublicationEligibility(baseAdmission, record, {
        now: stuckNow,
      });
      assert.equal(view.durableVerificationState, "verifying");
      assert.equal(view.publicationEligible, false);
      if (view.presence === "present") {
        assert.equal(view.observationalStuck, true);
        assert.equal(view.observationalRetryClassification, "operator_required");
      }
    }

    const loaded = await getVerificationRecord(baseAdmission, makeDeps().store);
    assert.equal(loaded, null);
  });
});
