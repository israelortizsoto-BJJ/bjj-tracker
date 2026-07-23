/**
 * Node test polyfill for Workers crypto.DigestStream.
 * Production inspection requires DigestStream; Node unit tests install this shim.
 */

import { createHash } from "node:crypto";

type DigestStreamLike = WritableStream<ArrayBuffer | ArrayBufferView> & {
  readonly digest: Promise<ArrayBuffer>;
};

export function installDigestStreamPolyfillForTests(): void {
  const cryptoWithDigest = crypto as Crypto & {
    DigestStream?: new (algorithm: string) => DigestStreamLike;
  };
  if (typeof cryptoWithDigest.DigestStream === "function") {
    return;
  }

  class DigestStreamPolyfill extends WritableStream<ArrayBuffer | ArrayBufferView> {
    readonly digest: Promise<ArrayBuffer>;
    constructor(algorithm: string) {
      const nodeAlgorithm = algorithm === "SHA-256" ? "sha256" : algorithm.toLowerCase();
      const hash = createHash(nodeAlgorithm);
      let resolveDigest!: (value: ArrayBuffer) => void;
      let rejectDigest!: (reason: unknown) => void;
      const digest = new Promise<ArrayBuffer>((resolve, reject) => {
        resolveDigest = resolve;
        rejectDigest = reject;
      });
      super({
        write(chunk) {
          const view =
            chunk instanceof ArrayBuffer
              ? new Uint8Array(chunk)
              : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
          hash.update(view);
        },
        close() {
          const digestBytes = hash.digest();
          const copy = digestBytes.buffer.slice(
            digestBytes.byteOffset,
            digestBytes.byteOffset + digestBytes.byteLength,
          ) as ArrayBuffer;
          resolveDigest(copy);
        },
        abort(reason) {
          rejectDigest(reason ?? new Error("DigestStream aborted"));
        },
      });
      this.digest = digest;
    }
  }

  cryptoWithDigest.DigestStream = DigestStreamPolyfill;
}
