import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  PROOF_MEDIA_STORAGE_BUCKET_BINDING,
  assertProductionMediaStorageBucketBinding,
  isProductionMediaStorageBucketBinding,
  rejectProofMediaStorageBucketBinding,
} from "./storageBucketBinding.ts";

describe("production storageBucketBinding freeze", () => {
  it("freezes MEDIA as the production binding identity", () => {
    assert.equal(PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING, "MEDIA");
    assert.equal(isProductionMediaStorageBucketBinding("MEDIA"), true);
    assert.equal(isProductionMediaStorageBucketBinding("PROOF_MEDIA"), false);
    assert.equal(isProductionMediaStorageBucketBinding("matmind-coach-media"), false);
  });

  it("rejects PROOF_MEDIA on the production path", () => {
    assert.equal(PROOF_MEDIA_STORAGE_BUCKET_BINDING, "PROOF_MEDIA");
    assert.throws(
      () => rejectProofMediaStorageBucketBinding("PROOF_MEDIA"),
      /PROOF_MEDIA/,
    );
    assert.throws(
      () => assertProductionMediaStorageBucketBinding("PROOF_MEDIA"),
      /MEDIA/,
    );
    assert.doesNotThrow(() => assertProductionMediaStorageBucketBinding("MEDIA"));
    assert.doesNotThrow(() => rejectProofMediaStorageBucketBinding("MEDIA"));
  });
});
