/**
 * Runtime-shaped DigestStream smoke using Miniflare (Wrangler Workers runtime).
 * Proves crypto.DigestStream exists and hashes bytes without a full-object buffer.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { Miniflare } from "miniflare";

describe("DigestStream Miniflare smoke", () => {
  it("crypto.DigestStream hashes multi-chunk input in the Workers runtime", async () => {
    const mf = new Miniflare({
      modules: true,
      script: `
        function bytesToHex(bytes) {
          return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        }
        export default {
          async fetch() {
            const digestStream = new crypto.DigestStream("SHA-256");
            const writer = digestStream.getWriter();
            const digestPromise = digestStream.digest;
            const chunks = [
              new Uint8Array([1, 2, 3, 4, 5]),
              new Uint8Array([6, 7, 8, 9, 10]),
              new Uint8Array([11, 12, 13]),
            ];
            let observed = 0;
            for (const chunk of chunks) {
              observed += chunk.byteLength;
              await writer.write(chunk);
            }
            await writer.close();
            const digest = new Uint8Array(await digestPromise);
            return Response.json({
              hasDigestStream: typeof crypto.DigestStream === "function",
              observedByteCount: observed,
              sha256: bytesToHex(digest),
            });
          }
        }
      `,
    });

    try {
      const response = await mf.dispatchFetch("http://localhost/");
      assert.equal(response.status, 200);
      const body = await response.json();
      const expected = createHash("sha256")
        .update(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]))
        .digest("hex");
      assert.equal(body.hasDigestStream, true);
      assert.equal(body.observedByteCount, 13);
      assert.equal(body.sha256, expected);
    } finally {
      await mf.dispose();
    }
  });
});
