import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  admitVerification,
  transitionVerificationTerminal,
  type VerificationAdmissionDependencies,
} from "./admitVerification.ts";
import { createConditionalObjectVerificationRecordStore } from "./conditionalObjectVerificationRecordStore.ts";
import { createSyntheticConditionalObjectStore } from "./syntheticConditionalObjectStore.ts";
import { deriveVerifiedMediaPublicationEligibility } from "./publicationEligibility.ts";
import { PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING } from "./storageBucketBinding.ts";
import type { ImmutableAdmissionFields } from "./admissionIdentity.ts";

const expectedAdmission: ImmutableAdmissionFields = {
  contractVersion: "shared-match-media-production-verification-design-v1",
  storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  objectVersion: "object-version-1",
  storageObjectKey: "match-media/assets/mma_11111111-2222-4333-8444-555555555555/original",
};

function deps(): VerificationAdmissionDependencies {
  const objects = createSyntheticConditionalObjectStore();
  return {
    store: createConditionalObjectVerificationRecordStore(objects),
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    randomId: () => "fixed-random-id",
  };
}

async function admitWithProvenance(
  admissionDeps: VerificationAdmissionDependencies,
  extras?: Partial<{
    athleteId: string;
    competitionId: string;
    matchLineageKey: string;
    matchId: string;
  }>,
) {
  return admitVerification(
    {
      ...expectedAdmission,
      declaredByteCount: 32,
      declaredMimeType: "video/mp4",
      athleteId: extras?.athleteId ?? "athlete_1",
      competitionId: extras?.competitionId ?? "competition_1",
      matchLineageKey: extras?.matchLineageKey ?? "match_lineage_1",
      ...(extras?.matchId ? { matchId: extras.matchId } : {}),
    },
    admissionDeps,
  );
}

describe("deriveVerifiedMediaPublicationEligibility", () => {
  it("fails closed when the record is absent", async () => {
    const view = await deriveVerifiedMediaPublicationEligibility(expectedAdmission, null);
    assert.equal(view.presence, "absent");
    assert.equal(view.publicationEligible, false);
    assert.equal(view.durableVerificationState, null);
    assert.equal(view.admissionKeyHash.length, 64);
  });

  it("fails closed on identity mismatch", async () => {
    const admissionDeps = deps();
    const created = await admitWithProvenance(admissionDeps);
    const other: ImmutableAdmissionFields = {
      ...expectedAdmission,
      objectVersion: "other-version",
    };
    const view = await deriveVerifiedMediaPublicationEligibility(other, created.record);
    assert.equal(view.presence, "identity_mismatch");
    assert.equal(view.publicationEligible, false);
  });

  it("marks verifying, rejected, and failed durable states ineligible", async () => {
    {
      const admissionDeps = deps();
      const created = await admitWithProvenance(admissionDeps);
      const view = await deriveVerifiedMediaPublicationEligibility(
        expectedAdmission,
        created.record,
      );
      assert.equal(view.presence, "present");
      assert.equal(view.publicationEligible, false);
      assert.equal(view.durableVerificationState, "verifying");
    }

    {
      const admissionDeps = deps();
      const created = await admitWithProvenance(admissionDeps);
      const rejected = await transitionVerificationTerminal(
        {
          admissionKeyHash: created.record.admissionKeyHash,
          targetState: "rejected",
          terminalReasonCode: "MIME_NOT_ALLOWED",
        },
        admissionDeps,
      );
      const view = await deriveVerifiedMediaPublicationEligibility(
        expectedAdmission,
        rejected,
      );
      assert.equal(view.presence, "present");
      assert.equal(view.publicationEligible, false);
      assert.equal(view.durableVerificationState, "rejected");
    }

    {
      const admissionDeps = deps();
      const created = await admitWithProvenance(admissionDeps);
      const failed = await transitionVerificationTerminal(
        {
          admissionKeyHash: created.record.admissionKeyHash,
          targetState: "failed",
          terminalReasonCode: "STORAGE_READ_TRANSIENT",
        },
        admissionDeps,
      );
      const view = await deriveVerifiedMediaPublicationEligibility(
        expectedAdmission,
        failed,
      );
      assert.equal(view.presence, "present");
      assert.equal(view.publicationEligible, false);
      assert.equal(view.durableVerificationState, "failed");
    }
  });

  it("is eligible only for exact verified identity with complete provenance", async () => {
    const admissionDeps = deps();
    const created = await admitWithProvenance(admissionDeps, {
      matchId: "match_1",
    });
    const verified = await transitionVerificationTerminal(
      {
        admissionKeyHash: created.record.admissionKeyHash,
        targetState: "verified",
        calculatedSha256: "c".repeat(64),
        observedByteCount: 32,
        observedMimeType: "video/mp4",
      },
      admissionDeps,
    );
    const view = await deriveVerifiedMediaPublicationEligibility(
      expectedAdmission,
      verified,
    );
    assert.equal(view.presence, "present");
    assert.equal(view.publicationEligible, true);
    assert.equal(view.durableVerificationState, "verified");
    if (view.presence === "present") {
      assert.equal(view.sharedAthleteId, "athlete_1");
      assert.equal(view.sharedCompetitionId, "competition_1");
      assert.equal(view.matchLineageKey, "match_lineage_1");
      assert.equal(view.matchId, "match_1");
      assert.equal(view.calculatedSha256, "c".repeat(64));
    }
  });

  it("keeps verified incomplete provenance ineligible", async () => {
    const admissionDeps = deps();
    const created = await admitVerification(
      {
        ...expectedAdmission,
        declaredByteCount: 32,
        declaredMimeType: "video/mp4",
        athleteId: "athlete_1",
      },
      admissionDeps,
    );
    const verified = await transitionVerificationTerminal(
      {
        admissionKeyHash: created.record.admissionKeyHash,
        targetState: "verified",
        calculatedSha256: "d".repeat(64),
      },
      admissionDeps,
    );
    const view = await deriveVerifiedMediaPublicationEligibility(
      expectedAdmission,
      verified,
    );
    assert.equal(view.presence, "present");
    assert.equal(view.publicationEligible, false);
  });

  it("keeps stuck durably verifying with observational operator_required", async () => {
    const admissionDeps = deps();
    const created = await admitWithProvenance(admissionDeps);
    const stuckNow = new Date(
      Date.parse(created.record.updatedAt) + 60 * 60 * 1000,
    );
    const view = await deriveVerifiedMediaPublicationEligibility(
      expectedAdmission,
      created.record,
      { now: stuckNow },
    );
    assert.equal(view.presence, "present");
    assert.equal(view.publicationEligible, false);
    assert.equal(view.durableVerificationState, "verifying");
    if (view.presence === "present") {
      assert.equal(view.observationalStuck, true);
      assert.equal(
        view.observationalReasonCode,
        "STUCK_ATTEMPT_REQUIRES_RECONCILIATION",
      );
      assert.equal(view.observationalRetryClassification, "operator_required");
      assert.equal(view.terminalReasonCode, null);
      assert.equal(view.retryClassification, null);
    }
  });
});
