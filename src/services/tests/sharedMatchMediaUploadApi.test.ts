import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";

import {
  buildSharedMatchMediaPartPlan,
  defaultSha256Hex,
  isServerReportedVerifiedUploadCompletion,
  replayParentSharedMatchMediaUploadCompletion,
  uploadParentSharedMatchMediaVideo,
  type SharedMatchMediaUploadHttpResponse,
} from "../sharedMatchMediaUploadApi.ts";

const TOKEN = "a".repeat(48);
const SECRET = "parent-secret";

/** NIST / FIPS 180-4 known vector: SHA-256("abc"). */
const SHA256_ABC_HEX = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

/** Authoritative SHA-256 of exact bytes [1, 2, 3, 4, 5]. */
const SHA256_BYTES_1_TO_5_HEX =
  "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0";

function hex64(seed: string): string {
  return seed.repeat(64).slice(0, 64);
}

function nodeSha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Shared Match Media transport part plan", () => {
  it("uses a single part for videos at or under the transport size", () => {
    assert.deepEqual(buildSharedMatchMediaPartPlan(12_345_678, 99_000_000), [
      { partNumber: 1, offset: 0, byteCount: 12_345_678 },
    ]);
  });

  it("splits larger videos into transport-safe fixed parts plus a final remainder", () => {
    const plan = buildSharedMatchMediaPartPlan(99_000_000 * 2 + 123, 99_000_000);
    assert.deepEqual(plan, [
      { partNumber: 1, offset: 0, byteCount: 99_000_000 },
      { partNumber: 2, offset: 99_000_000, byteCount: 99_000_000 },
      { partNumber: 3, offset: 198_000_000, byteCount: 123 },
    ]);
  });
});

describe("Parent Shared Match Media upload client", () => {
  it("treats only an exact Worker verified completion report as publication-eligible", () => {
    assert.equal(isServerReportedVerifiedUploadCompletion(undefined), false);
    assert.equal(
      isServerReportedVerifiedUploadCompletion({
        outcome: "verified",
        verificationState: "verifying",
        verificationAttempted: true,
      }),
      false,
    );
    assert.equal(
      isServerReportedVerifiedUploadCompletion({
        outcome: "verified",
        verificationState: "verified",
        verificationAttempted: true,
      }),
      true,
    );
  });

  it("completes multipart upload and captures immutable asset identity plus object version", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const result = await uploadParentSharedMatchMediaVideo({
      linkToken: TOKEN,
      parentWriterSecret: SECRET,
      localUri: "file:///tmp/match.mp4",
      associations: {
        sharedAthleteId: "shared_ath_1",
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
      },
      apiBaseUrlOverride: "https://worker.test",
      dependencies: {
        transportPartBytes: 3,
        openLocalFile: async () => ({
          byteCount: bytes.byteLength,
          mimeType: "video/mp4",
          readPart: async (offset, length) => bytes.slice(offset, offset + length),
        }),
        sha256Hex: async (chunk) => hex64(`p${chunk.byteLength}`),
        http: async ({ method, url, headers, body }) => {
          calls.push({ method, url });
          assert.equal(headers.Authorization, `Bearer ${SECRET}`);
          if (method === "POST" && url.endsWith("/match-media/uploads")) {
            assert.equal(typeof body, "string");
            const intent = JSON.parse(String(body)) as Record<string, unknown>;
            assert.equal(intent.sharedAthleteId, "shared_ath_1");
            assert.equal(intent.sharedCompetitionId, "shared_comp_1");
            assert.equal(intent.matchLineageKey, "match_1");
            assert.equal(intent.declaredByteCount, 5);
            return {
              status: 201,
              json: {
                asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                uploadSession: {
                  uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  protocol: "r2_multipart",
                  status: "upload_pending",
                },
              },
            } satisfies SharedMatchMediaUploadHttpResponse;
          }
          if (method === "PUT" && url.includes("/parts/")) {
            assert.match(url, /assetId=mma_11111111-2222-4333-8444-555555555555/);
            assert.ok(body instanceof Uint8Array);
            return {
              status: 201,
              json: { part: { partNumber: Number(url.match(/\/parts\/(\d+)/)?.[1]), byteCount: (body as Uint8Array).byteLength } },
            };
          }
          if (method === "POST" && url.includes("/complete")) {
            return {
              status: 201,
              json: {
                asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                uploadSession: {
                  uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "upload_complete",
                  completedByteCount: 5,
                  completedAt: "2026-07-22T12:00:00.000Z",
                  objectVersion: "object-version-1",
                },
              },
            };
          }
          throw new Error(`unexpected ${method} ${url}`);
        },
      },
    });

    assert.equal(result.status, "upload_complete");
    assert.equal(result.matchMediaAssetId, "mma_11111111-2222-4333-8444-555555555555");
    assert.equal(result.objectVersion, "object-version-1");
    assert.equal(result.sharedAthleteId, "shared_ath_1");
    assert.equal(result.sharedCompetitionId, "shared_comp_1");
    assert.equal(result.matchLineageKey, "match_1");
    assert.equal(result.localSourceUri, "file:///tmp/match.mp4");
    assert.equal(calls.filter((c) => c.method === "PUT").length, 2);
    assert.ok(calls.some((c) => c.method === "POST" && c.url.includes("/complete")));
  });

  it("rejects completion payloads that omit object version without recording success", async () => {
    await assert.rejects(
      () =>
        uploadParentSharedMatchMediaVideo({
          linkToken: TOKEN,
          parentWriterSecret: SECRET,
          localUri: "file:///tmp/match.mp4",
          associations: {
            sharedAthleteId: "shared_ath_1",
            sharedCompetitionId: "shared_comp_1",
            matchLineageKey: "match_1",
          },
          apiBaseUrlOverride: "https://worker.test",
          dependencies: {
            openLocalFile: async () => ({
              byteCount: 4,
              mimeType: "video/mp4",
              readPart: async () => new Uint8Array([1, 2, 3, 4]),
            }),
            sha256Hex: async () => hex64("x"),
            http: async ({ method, url }) => {
              if (method === "POST" && url.endsWith("/match-media/uploads")) {
                return {
                  status: 201,
                  json: {
                    asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                    uploadSession: {
                      uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                      status: "upload_pending",
                    },
                  },
                };
              }
              if (method === "PUT") {
                return { status: 201, json: { part: { partNumber: 1, byteCount: 4 } } };
              }
              return {
                status: 201,
                json: {
                  asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                  uploadSession: {
                    uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    status: "upload_complete",
                    completedByteCount: 4,
                    completedAt: "2026-07-22T12:00:00.000Z",
                  },
                },
              };
            },
          },
        }),
      /object version/i,
    );
  });

  it("surfaces foundation failures without claiming upload_complete", async () => {
    await assert.rejects(
      () =>
        uploadParentSharedMatchMediaVideo({
          linkToken: TOKEN,
          parentWriterSecret: SECRET,
          localUri: "file:///tmp/match.mp4",
          associations: {
            sharedAthleteId: "shared_ath_1",
            sharedCompetitionId: "shared_comp_1",
            matchLineageKey: "match_1",
          },
          apiBaseUrlOverride: "https://worker.test",
          dependencies: {
            openLocalFile: async () => ({
              byteCount: 4,
              mimeType: "video/mp4",
              readPart: async () => new Uint8Array([1, 2, 3, 4]),
            }),
            sha256Hex: async () => hex64("x"),
            http: async () => ({ status: 401, json: { error: "Unauthorized" } }),
          },
        }),
      /Unauthorized/,
    );
  });

  it("accepts idempotent intent and completion replays as upload_complete", async () => {
    let intentCalls = 0;
    let completeCalls = 0;
    const result = await uploadParentSharedMatchMediaVideo({
      linkToken: TOKEN,
      parentWriterSecret: SECRET,
      localUri: "file:///tmp/match.mp4",
      associations: {
        sharedAthleteId: "shared_ath_1",
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
      },
      apiBaseUrlOverride: "https://worker.test",
      dependencies: {
        openLocalFile: async () => ({
          byteCount: 2,
          mimeType: "video/mp4",
          readPart: async () => new Uint8Array([9, 9]),
        }),
        sha256Hex: async () => hex64("r"),
        http: async ({ method, url }) => {
          if (method === "POST" && url.endsWith("/match-media/uploads")) {
            intentCalls += 1;
            return {
              status: 200,
              json: {
                asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                uploadSession: {
                  uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "upload_pending",
                },
                idempotentReplay: true,
              },
            };
          }
          if (method === "PUT") {
            return { status: 200, json: { part: { partNumber: 1, byteCount: 2 }, idempotentReplay: true } };
          }
          completeCalls += 1;
          return {
            status: 200,
            json: {
              asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
              uploadSession: {
                uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "upload_complete",
                completedByteCount: 2,
                completedAt: "2026-07-22T12:00:00.000Z",
                objectVersion: "object-version-replay",
              },
              idempotentReplay: true,
            },
          };
        },
      },
    });

    assert.equal(intentCalls, 1);
    assert.equal(completeCalls, 1);
    assert.equal(result.idempotentReplay, true);
    assert.equal(result.objectVersion, "object-version-replay");
    assert.equal(result.status, "upload_complete");
  });

  it("replays only a persisted completion identity and accepts a verified Worker report", async () => {
    const result = await replayParentSharedMatchMediaUploadCompletion({
      linkToken: TOKEN,
      parentWriterSecret: SECRET,
      uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
      objectVersion: "object-version-1",
      associations: {
        sharedAthleteId: "shared_ath_1",
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
      },
      apiBaseUrlOverride: "https://worker.test",
      dependencies: {
        http: async ({ method, url, headers }) => {
          assert.equal(method, "POST");
          assert.equal(headers.Authorization, `Bearer ${SECRET}`);
          assert.match(url, /uploads\/mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\/complete\?assetId=mma_11111111/);
          return {
            status: 200,
            json: {
              asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
              uploadSession: {
                uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "upload_complete",
                completedByteCount: 5,
                completedAt: "2026-07-25T12:00:00.000Z",
                objectVersion: "object-version-1",
              },
              idempotentReplay: true,
              productionVerification: {
                outcome: "verified",
                verificationState: "verified",
                verificationAttempted: true,
              },
            },
          };
        },
      },
    });
    assert.equal(result.idempotentReplay, true);
    assert.equal(result.serverReportedVerified, true);
    assert.equal(result.objectVersion, "object-version-1");
  });

  it("rejects a completion replay whose immutable version differs from persisted state", async () => {
    await assert.rejects(
      () =>
        replayParentSharedMatchMediaUploadCompletion({
          linkToken: TOKEN,
          parentWriterSecret: SECRET,
          uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
          objectVersion: "object-version-1",
          associations: {
            sharedAthleteId: "shared_ath_1",
            sharedCompetitionId: "shared_comp_1",
            matchLineageKey: "match_1",
          },
          apiBaseUrlOverride: "https://worker.test",
          dependencies: {
            http: async () => ({
              status: 200,
              json: {
                asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                uploadSession: {
                  uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "upload_complete",
                  completedByteCount: 5,
                  completedAt: "2026-07-25T12:00:00.000Z",
                  objectVersion: "different-version",
                },
              },
            }),
          },
        }),
      /did not confirm/i,
    );
  });

  it("rejects remote http(s) URIs as non-uploadable media references", async () => {
    await assert.rejects(
      () =>
        uploadParentSharedMatchMediaVideo({
          linkToken: TOKEN,
          parentWriterSecret: SECRET,
          localUri: "https://example.com/clip.mp4",
          associations: {
            sharedAthleteId: "shared_ath_1",
            sharedCompetitionId: "shared_comp_1",
            matchLineageKey: "match_1",
          },
          apiBaseUrlOverride: "https://worker.test",
          dependencies: {
            http: async () => {
              throw new Error("http should not be called");
            },
          },
        }),
      /device-local/i,
    );
  });

  it("hashes the exact uploaded part bytes into X-MatMind-Part-SHA256", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const partHeaders: string[] = [];
    await uploadParentSharedMatchMediaVideo({
      linkToken: TOKEN,
      parentWriterSecret: SECRET,
      localUri: "file:///tmp/match.mp4",
      associations: {
        sharedAthleteId: "shared_ath_1",
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
      },
      apiBaseUrlOverride: "https://worker.test",
      dependencies: {
        transportPartBytes: 5,
        openLocalFile: async () => ({
          byteCount: bytes.byteLength,
          mimeType: "video/mp4",
          readPart: async (offset, length) => bytes.slice(offset, offset + length),
        }),
        // Exercise default hashing (not an injected stub) for the uploaded bytes.
        http: async ({ method, url, headers, body }) => {
          if (method === "POST" && url.endsWith("/match-media/uploads")) {
            return {
              status: 201,
              json: {
                asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                uploadSession: {
                  uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "upload_pending",
                },
              },
            };
          }
          if (method === "PUT" && url.includes("/parts/")) {
            assert.ok(body instanceof Uint8Array);
            assert.deepEqual(Array.from(body as Uint8Array), [1, 2, 3, 4, 5]);
            partHeaders.push(String(headers["X-MatMind-Part-SHA256"]));
            return {
              status: 201,
              json: { part: { partNumber: 1, byteCount: 5 } },
            };
          }
          return {
            status: 201,
            json: {
              asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
              uploadSession: {
                uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "upload_complete",
                completedByteCount: 5,
                completedAt: "2026-07-22T12:00:00.000Z",
                objectVersion: "object-version-1",
              },
            },
          };
        },
      },
    });
    assert.deepEqual(partHeaders, [SHA256_BYTES_1_TO_5_HEX]);
    assert.equal(partHeaders[0], nodeSha256Hex(bytes));
  });

  it("does not claim upload_complete when part hashing fails", async () => {
    let completeCalls = 0;
    await assert.rejects(
      () =>
        uploadParentSharedMatchMediaVideo({
          linkToken: TOKEN,
          parentWriterSecret: SECRET,
          localUri: "file:///tmp/match.mp4",
          associations: {
            sharedAthleteId: "shared_ath_1",
            sharedCompetitionId: "shared_comp_1",
            matchLineageKey: "match_1",
          },
          apiBaseUrlOverride: "https://worker.test",
          dependencies: {
            openLocalFile: async () => ({
              byteCount: 4,
              mimeType: "video/mp4",
              readPart: async () => new Uint8Array([1, 2, 3, 4]),
            }),
            sha256Hex: async () => {
              throw new Error("hash failed");
            },
            http: async ({ method, url }) => {
              if (method === "POST" && url.endsWith("/match-media/uploads")) {
                return {
                  status: 201,
                  json: {
                    asset: { matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555" },
                    uploadSession: {
                      uploadSessionId: "mmus_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                      status: "upload_pending",
                    },
                  },
                };
              }
              if (method === "POST" && url.includes("/complete")) {
                completeCalls += 1;
              }
              throw new Error(`unexpected ${method} ${url}`);
            },
          },
        }),
      /hash failed/,
    );
    assert.equal(completeCalls, 0);
  });
});

describe("defaultSha256Hex Hermes-safe hashing", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("produces lowercase hex for the NIST SHA-256('abc') vector", async () => {
    const bytes = new TextEncoder().encode("abc");
    const hex = await defaultSha256Hex(bytes);
    assert.equal(hex, SHA256_ABC_HEX);
    assert.equal(hex, hex.toLowerCase());
    assert.match(hex, /^[0-9a-f]{64}$/);
  });

  it("produces the authoritative digest for exact upload bytes [1,2,3,4,5]", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const hex = await defaultSha256Hex(bytes);
    assert.equal(hex, SHA256_BYTES_1_TO_5_HEX);
    assert.equal(hex, nodeSha256Hex(bytes));
  });

  it("succeeds when globalThis.crypto is absent via expo-crypto digest of exact bytes", async () => {
    const originalCrypto = globalThis.crypto;
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    let digested: Uint8Array | null = null;

    mock.module("expo-crypto", {
      namedExports: {
        CryptoDigestAlgorithm: { SHA256: "SHA-256" },
        digest: async (_algorithm: string, data: BufferSource) => {
          const view =
            data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          digested = new Uint8Array(view);
          const hash = createHash("sha256").update(view).digest();
          return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
        },
      },
    });

    try {
      // Simulate Hermes/RN where Web Crypto is missing — never touch bare `crypto`.
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        writable: true,
        value: undefined,
      });
      const hex = await defaultSha256Hex(bytes);
      assert.deepEqual(digested ? Array.from(digested) : null, [1, 2, 3, 4, 5]);
      assert.equal(hex, SHA256_BYTES_1_TO_5_HEX);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        writable: true,
        value: originalCrypto,
      });
    }
  });
});
