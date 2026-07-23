import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ISO_BMFF_ACCEPTED_BRANDS,
  MIME_PREFIX_LIMIT,
  detectContainerSignature,
  evaluateMimePolicy,
  normalizeDeclaredMimeType,
  type DetectedContainer,
} from "./mimePolicy.ts";

function ftypPrefix(brand: string, totalLength = 32): Uint8Array {
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, totalLength);
  bytes[4] = "f".charCodeAt(0);
  bytes[5] = "t".charCodeAt(0);
  bytes[6] = "y".charCodeAt(0);
  bytes[7] = "p".charCodeAt(0);
  for (let i = 0; i < 4; i += 1) {
    bytes[8 + i] = brand.charCodeAt(i) || 0x20;
  }
  return bytes;
}

describe("first-slice MIME policy", () => {
  it("freezes ISO-BMFF prefix limit and accepted brands", () => {
    assert.equal(MIME_PREFIX_LIMIT, 4096);
    assert.deepEqual([...ISO_BMFF_ACCEPTED_BRANDS], ["isom", "iso2", "mp41", "mp42", "qt  "]);
  });

  it("passes all accepted ISO-BMFF brands for video/mp4", () => {
    for (const brand of ISO_BMFF_ACCEPTED_BRANDS) {
      const detected = detectContainerSignature(ftypPrefix(brand));
      assert.equal(detected.kind, "iso_bmff");
      const result = evaluateMimePolicy("video/mp4", detected, {
        r2ContentType: "application/octet-stream",
      });
      assert.equal(result.outcome, "pass");
      if (result.outcome === "pass") {
        assert.equal(result.observedMimeType, "video/mp4");
        assert.equal(result.detectedBrand, brand);
        assert.equal(result.r2ContentTypeDisagreesWithDetection, true);
      }
    }
  });

  it("normalizes QuickTime declaration to pass with observed video/mp4", () => {
    const detected = detectContainerSignature(ftypPrefix("qt  "));
    const result = evaluateMimePolicy("  Video/QuickTime  ", detected);
    assert.equal(result.outcome, "pass");
    if (result.outcome === "pass") {
      assert.equal(result.declaredMimeType, "video/quicktime");
      assert.equal(result.observedMimeType, "video/mp4");
    }
  });

  it("uses MIME_NOT_ALLOWED for empty or syntactically invalid declared MIME", () => {
    for (const raw of ["", "   ", "not-a-mime", "video/", "/mp4", 12 as unknown]) {
      const normalized = normalizeDeclaredMimeType(raw);
      assert.equal(normalized.kind, "not_allowed");
      const result = evaluateMimePolicy(raw, detectContainerSignature(ftypPrefix("isom")));
      assert.equal(result.outcome, "reject");
      if (result.outcome === "reject") {
        assert.equal(result.terminalReasonCode, "MIME_NOT_ALLOWED");
      }
    }
  });

  it("uses UNSUPPORTED_MEDIA_FORMAT for WebM and other unsupported well-formed types", () => {
    for (const raw of ["video/webm", "video/x-matroska", "image/png", "application/pdf"]) {
      const result = evaluateMimePolicy(raw, detectContainerSignature(ftypPrefix("isom")));
      assert.equal(result.outcome, "reject");
      if (result.outcome === "reject") {
        assert.equal(result.terminalReasonCode, "UNSUPPORTED_MEDIA_FORMAT");
      }
    }
  });

  it("uses UNSUPPORTED_MEDIA_FORMAT for inconclusive detection", () => {
    const short = new Uint8Array(8);
    assert.equal(detectContainerSignature(short).kind, "inconclusive");
    const nonFtyp = new Uint8Array(32);
    nonFtyp.set(new TextEncoder().encode("....mdat"), 0);
    assert.equal(detectContainerSignature(nonFtyp).kind, "inconclusive");

    const result = evaluateMimePolicy("video/mp4", { kind: "inconclusive" });
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "UNSUPPORTED_MEDIA_FORMAT");
    }
  });

  it("uses MIME_SIGNATURE_MISMATCH for conflicting recognized foreign family", () => {
    const foreign: DetectedContainer = {
      kind: "recognized_foreign_family",
      family: "webm",
    };
    const result = evaluateMimePolicy("video/mp4", foreign);
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "MIME_SIGNATURE_MISMATCH");
    }
  });

  it("never lets R2 content-type alone produce a MIME pass", () => {
    const result = evaluateMimePolicy("video/mp4", { kind: "inconclusive" }, {
      r2ContentType: "video/mp4",
    });
    assert.equal(result.outcome, "reject");
    if (result.outcome === "reject") {
      assert.equal(result.terminalReasonCode, "UNSUPPORTED_MEDIA_FORMAT");
    }
  });
});
