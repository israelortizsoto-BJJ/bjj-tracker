import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { evaluateObjectIntegrity } from "./objectIntegrityPolicy.ts";
import { ISO_BMFF_ACCEPTED_BRANDS } from "./mimePolicy.ts";

function ftypPrefix(brand: string = "isom"): Uint8Array {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 32);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(brand.padEnd(4, " ").slice(0, 4)), 8);
  return bytes;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("object integrity policy", () => {
  const body = ftypPrefix("mp41");
  const calculatedSha256 = sha256Hex(body);

  it("passes when MIME, bytes, and expected SHA all match", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/mp4",
      declaredByteCount: body.byteLength,
      expectedWholeObjectSha256: calculatedSha256,
      observedByteCount: body.byteLength,
      calculatedSha256,
      mimePrefix: body,
      r2ContentType: "text/plain",
    });
    assert.equal(result.outcome, "pass");
    if (result.outcome === "pass") {
      assert.equal(result.shaComparison, "matched");
      assert.equal(result.observedMimeType, "video/mp4");
      assert.equal(result.calculatedSha256, calculatedSha256);
    }
  });

  it("records calculated SHA and can succeed when expected SHA is absent", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/quicktime",
      declaredByteCount: body.byteLength,
      observedByteCount: body.byteLength,
      calculatedSha256,
      mimePrefix: body,
    });
    assert.equal(result.outcome, "pass");
    if (result.outcome === "pass") {
      assert.equal(result.shaComparison, "skipped_absent_expected");
      assert.equal(result.expectedWholeObjectSha256, null);
      assert.equal(result.calculatedSha256, calculatedSha256);
    }
  });

  it("rejects byte-count mismatch", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/mp4",
      declaredByteCount: body.byteLength + 1,
      observedByteCount: body.byteLength,
      calculatedSha256,
      mimePrefix: body,
    });
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "BYTE_COUNT_MISMATCH");
    }
  });

  it("rejects expected-SHA mismatch", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/mp4",
      declaredByteCount: body.byteLength,
      expectedWholeObjectSha256: "a".repeat(64),
      observedByteCount: body.byteLength,
      calculatedSha256,
      mimePrefix: body,
    });
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "SHA256_MISMATCH");
      assert.equal(result.calculatedSha256, calculatedSha256);
    }
  });

  it("does not treat ETag-like tokens as whole-object SHA", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/mp4",
      declaredByteCount: body.byteLength,
      expectedWholeObjectSha256: `"multipart-etag-not-a-sha"`,
      observedByteCount: body.byteLength,
      calculatedSha256,
      mimePrefix: body,
    });
    // Invalid expected digest normalizes to absent → SHA compare skipped.
    assert.equal(result.outcome, "pass");
    if (result.outcome === "pass") {
      assert.equal(result.shaComparison, "skipped_absent_expected");
    }
  });

  it("rejects when only R2 content-type looks valid but signature is inconclusive", () => {
    const result = evaluateObjectIntegrity({
      declaredMimeType: "video/mp4",
      declaredByteCount: 4,
      observedByteCount: 4,
      calculatedSha256: "b".repeat(64),
      mimePrefix: new Uint8Array([0, 1, 2, 3]),
      r2ContentType: "video/mp4",
    });
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "UNSUPPORTED_MEDIA_FORMAT");
    }
  });

  it("accepts every ISO-BMFF brand under integrity pass", () => {
    for (const brand of ISO_BMFF_ACCEPTED_BRANDS) {
      const prefix = ftypPrefix(brand);
      const digest = sha256Hex(prefix);
      const result = evaluateObjectIntegrity({
        declaredMimeType: "video/mp4",
        declaredByteCount: prefix.byteLength,
        observedByteCount: prefix.byteLength,
        calculatedSha256: digest,
        mimePrefix: prefix,
      });
      assert.equal(result.outcome, "pass", brand);
    }
  });
});
