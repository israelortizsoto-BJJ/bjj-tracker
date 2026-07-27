import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOLDEN_MATCH_MEDIA_OBJECT_KEY,
  GOLDEN_MATCH_MEDIA_OBJECT_VERSION,
  handleGoldenR2IdentityProbeHttpRequest,
} from "./goldenR2IdentityProbe.ts";

function makeBucket(
  object:
    | { version?: string; customMetadata?: Record<string, string> }
    | null,
) {
  let headCalls = 0;
  return {
    bucket: {
      head: async (key: string) => {
        headCalls += 1;
        assert.equal(key, GOLDEN_MATCH_MEDIA_OBJECT_KEY);
        return object;
      },
    },
    headCalls: () => headCalls,
  };
}

async function request(
  bucket: ReturnType<typeof makeBucket>["bucket"],
  authorizationHeader = "Bearer operator-secret",
) {
  return handleGoldenR2IdentityProbeHttpRequest({
    method: "POST",
    authorizationHeader,
    operatorSecret: "operator-secret",
    bucket,
  });
}

describe("Golden R2 identity probe", () => {
  it("returns the upload session only when the same HEAD has the certified version", async () => {
    const fake = makeBucket({
      version: GOLDEN_MATCH_MEDIA_OBJECT_VERSION,
      customMetadata: { uploadSessionId: "mmus_28fb3dab8825ce3001095ad55b655a68", unrelated: "hidden" },
    });
    const result = await request(fake.bucket);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      outcome: "object_version_match",
      uploadSessionId: "mmus_28fb3dab8825ce3001095ad55b655a68",
    });
    assert.equal(fake.headCalls(), 1);
  });

  it("rejects a mismatched object version without disclosing metadata", async () => {
    const fake = makeBucket({
      version: "different-version",
      customMetadata: { uploadSessionId: "mmus_should_not_leak" },
    });
    const result = await request(fake.bucket);
    assert.deepEqual(result.body, { outcome: "object_version_mismatch" });
    assert.equal(fake.headCalls(), 1);
  });

  it("reports a missing object or session metadata decisively", async () => {
    const missing = makeBucket(null);
    assert.deepEqual((await request(missing.bucket)).body, { outcome: "object_missing" });
    assert.equal(missing.headCalls(), 1);

    const noMetadata = makeBucket({ version: GOLDEN_MATCH_MEDIA_OBJECT_VERSION });
    assert.deepEqual((await request(noMetadata.bucket)).body, {
      outcome: "upload_session_id_missing",
    });
    assert.equal(noMetadata.headCalls(), 1);
  });

  it("rejects unauthorized callers before any R2 call", async () => {
    const fake = makeBucket({ version: GOLDEN_MATCH_MEDIA_OBJECT_VERSION });
    const result = await request(fake.bucket, "Bearer wrong-secret");
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "Unauthorized" });
    assert.equal(fake.headCalls(), 0);
  });

  it("rejects a non-POST method before any R2 call", async () => {
    const fake = makeBucket({ version: GOLDEN_MATCH_MEDIA_OBJECT_VERSION });
    const result = await handleGoldenR2IdentityProbeHttpRequest({
      method: "GET",
      authorizationHeader: "Bearer operator-secret",
      operatorSecret: "operator-secret",
      bucket: fake.bucket,
    });
    assert.equal(result.status, 405);
    assert.deepEqual(result.body, { error: "Method Not Allowed" });
    assert.equal(fake.headCalls(), 0);
  });

  it("permits no mutation or downstream callback surface", async () => {
    const fake = makeBucket({ version: GOLDEN_MATCH_MEDIA_OBJECT_VERSION });
    await request(fake.bucket);
    assert.equal(fake.headCalls(), 1);
    assert.deepEqual(Object.keys(fake.bucket), ["head"]);
  });
});
