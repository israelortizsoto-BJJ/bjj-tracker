import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { uploadMultipartPartWithSha256 } from "./uploadMultipartPartWithSha256.ts";

describe("uploadMultipartPartWithSha256 receiver-sensitive adapter", () => {
  it("invokes uploadPart with multipart as this and forwards args once", async () => {
    const body = new ReadableStream();
    const expected = { partNumber: 3, etag: "etag-abc" };
    let calls = 0;
    const sha256 = "a".repeat(64);

    const multipart = {
      uploadPart(
        this: unknown,
        partNumber: number,
        value: ReadableStream,
        options: { sha256: string },
      ) {
        calls += 1;
        assert.equal(this, multipart);
        assert.equal(partNumber, 3);
        assert.equal(value, body);
        assert.deepEqual(options, { sha256 });
        return Promise.resolve(expected);
      },
    };

    const result = await uploadMultipartPartWithSha256(multipart, 3, body, {
      sha256,
    });

    assert.equal(result, expected);
    assert.equal(calls, 1);
  });

  it("succeeds for an implementation that requires its receiver", async () => {
    class ReceiverSensitiveMultipart {
      readonly marker = "multipart-receiver";

      uploadPart(
        this: ReceiverSensitiveMultipart,
        partNumber: number,
        value: ReadableStream,
        options: { sha256: string },
      ) {
        void value;
        if (this?.marker !== "multipart-receiver") {
          throw new Error("missing multipart receiver");
        }
        return Promise.resolve({
          partNumber,
          etag: `etag-${partNumber}-${options.sha256.slice(0, 8)}`,
        });
      }
    }

    const multipart = new ReceiverSensitiveMultipart();
    const body = new ReadableStream();
    const sha256 = "b".repeat(64);

    const unbound = multipart.uploadPart;
    assert.throws(
      () => unbound(1, body, { sha256 }),
      /missing multipart receiver/,
    );

    const result = await uploadMultipartPartWithSha256(multipart, 1, body, {
      sha256,
    });
    assert.deepEqual(result, {
      partNumber: 1,
      etag: `etag-1-${"b".repeat(8)}`,
    });
  });
});
