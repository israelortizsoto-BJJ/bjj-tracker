import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  ADMISSION_FIELD_SEPARATOR,
  deriveAdmissionIdentity,
  serializeCanonicalAdmissionKey,
  sha256HexUtf8,
  type ImmutableAdmissionFields,
} from "./admissionIdentity.ts";

const base: ImmutableAdmissionFields = {
  contractVersion: "shared-match-media-production-verification-design-v1",
  storageBucketBinding: "MEDIA",
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  objectVersion: "object-version-1",
  storageObjectKey: "match-media/assets/mma_11111111-2222-4333-8444-555555555555/original",
};

describe("canonical admission identity", () => {
  it("serializes identically for identical values regardless of property order", () => {
    const shuffled = {
      objectVersion: base.objectVersion,
      matchMediaAssetId: base.matchMediaAssetId,
      storageObjectKey: base.storageObjectKey,
      contractVersion: base.contractVersion,
      storageBucketBinding: base.storageBucketBinding,
    };
    assert.equal(
      serializeCanonicalAdmissionKey(base),
      serializeCanonicalAdmissionKey(shuffled),
    );
  });

  it("uses explicit field order and unit separator", () => {
    const key = serializeCanonicalAdmissionKey(base);
    assert.equal(
      key,
      [
        base.contractVersion,
        base.storageBucketBinding,
        base.matchMediaAssetId,
        base.objectVersion,
        base.storageObjectKey,
      ].join(ADMISSION_FIELD_SEPARATOR),
    );
    assert.equal(key.split(ADMISSION_FIELD_SEPARATOR).length, 5);
  });

  it("trims surrounding whitespace per certified contract §6 language", () => {
    // Exact certified language:
    // "UTF-8 encode each component trimmed, with no surrounding whitespace variance."
    const padded: ImmutableAdmissionFields = {
      contractVersion: ` ${base.contractVersion} `,
      storageBucketBinding: `\t${base.storageBucketBinding}\t`,
      matchMediaAssetId: ` ${base.matchMediaAssetId}`,
      objectVersion: `${base.objectVersion} `,
      storageObjectKey: `  ${base.storageObjectKey}  `,
    };
    assert.equal(serializeCanonicalAdmissionKey(padded), serializeCanonicalAdmissionKey(base));
  });

  it("repeated hashing returns the same lowercase SHA-256 identity", async () => {
    const first = await deriveAdmissionIdentity(base);
    const second = await deriveAdmissionIdentity(base);
    assert.equal(first.admissionKey, second.admissionKey);
    assert.equal(first.admissionKeyHash, second.admissionKeyHash);
    assert.match(first.admissionKeyHash, /^[a-f0-9]{64}$/);

    const nodeHash = createHash("sha256").update(first.admissionKey, "utf8").digest("hex");
    assert.equal(first.admissionKeyHash, nodeHash);
    assert.equal(await sha256HexUtf8(first.admissionKey), nodeHash);
  });

  it("each of the five immutable fields affects identity", async () => {
    const baseline = await deriveAdmissionIdentity(base);
    const variants: ImmutableAdmissionFields[] = [
      { ...base, contractVersion: "other-contract-v1" },
      { ...base, storageBucketBinding: "PROOF_MEDIA" },
      { ...base, matchMediaAssetId: "mma_99999999-9999-4999-8999-999999999999" },
      { ...base, objectVersion: "object-version-2" },
      { ...base, storageObjectKey: "match-media/assets/other/original" },
    ];
    for (const variant of variants) {
      const identity = await deriveAdmissionIdentity(variant);
      assert.notEqual(identity.admissionKey, baseline.admissionKey);
      assert.notEqual(identity.admissionKeyHash, baseline.admissionKeyHash);
    }
  });

  it("mutable lifecycle fields are not part of identity", async () => {
    const withExtras = {
      ...base,
      state: "verified",
      attemptNumber: 9,
      terminalReasonCode: "BYTE_COUNT_MISMATCH",
      retryClassification: "non_retryable",
      updatedAt: "2099-01-01T00:00:00.000Z",
      randomId: "should-not-matter",
    } as ImmutableAdmissionFields & Record<string, unknown>;
    const identity = await deriveAdmissionIdentity(withExtras);
    const baseline = await deriveAdmissionIdentity(base);
    assert.equal(identity.admissionKey, baseline.admissionKey);
    assert.equal(identity.admissionKeyHash, baseline.admissionKeyHash);
  });

  it("rejects unit separator inside fields so boundaries cannot collapse", async () => {
    await assert.rejects(
      () =>
        deriveAdmissionIdentity({
          ...base,
          storageBucketBinding: `b${ADMISSION_FIELD_SEPARATOR}c`,
        }),
      /must not contain the unit separator/,
    );

    // Adjacent-looking values with different field boundaries stay distinct when
    // fields are well-formed (no embedded separator).
    const left = await deriveAdmissionIdentity({
      contractVersion: "ab",
      storageBucketBinding: "c",
      matchMediaAssetId: "d",
      objectVersion: "e",
      storageObjectKey: "f",
    });
    const right = await deriveAdmissionIdentity({
      contractVersion: "a",
      storageBucketBinding: "bc",
      matchMediaAssetId: "d",
      objectVersion: "e",
      storageObjectKey: "f",
    });
    assert.notEqual(left.admissionKey, right.admissionKey);
    assert.notEqual(left.admissionKeyHash, right.admissionKeyHash);
    assert.equal(left.admissionKey.split(ADMISSION_FIELD_SEPARATOR).length, 5);
  });

  it("supported Unicode input remains deterministic", async () => {
    const unicode: ImmutableAdmissionFields = {
      ...base,
      storageObjectKey: "match-media/assets/mma_unicode_道場_試合/original",
      storageBucketBinding: "バケット-メディア",
    };
    const first = await deriveAdmissionIdentity(unicode);
    const second = await deriveAdmissionIdentity(unicode);
    assert.equal(first.admissionKey, second.admissionKey);
    assert.equal(first.admissionKeyHash, second.admissionKeyHash);
    assert.ok(first.admissionKey.includes("道場"));
  });
});
