/**
 * Thin ConditionalObjectStore adapter over the coach-sync-worker MEDIA R2 binding.
 * Used only for Production Verification record durability (JSON + ETag CAS).
 */

import type {
  ConditionalObjectStore,
  ConditionalPutOnlyIf,
} from "../../../shared-match-media-production-verification/src/conditionalObjectStore.ts";

export type R2ConditionalBucket = {
  get(key: string): Promise<{ text(): Promise<string>; etag: string } | null>;
  put(
    key: string,
    value: string,
    options: {
      onlyIf: ConditionalPutOnlyIf;
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<{ etag: string } | null>;
};

export function createR2ConditionalObjectStore(
  bucket: R2ConditionalBucket,
): ConditionalObjectStore {
  return {
    get: async (key) => {
      const object = await bucket.get(key);
      if (!object) return null;
      return { body: await object.text(), etag: object.etag };
    },
    put: async (key, value, options) => {
      const object = await bucket.put(key, value, {
        onlyIf: options.onlyIf,
        httpMetadata: { contentType: "application/json" },
        customMetadata: { recordType: "production-verification-record-v1" },
      });
      return object ? { etag: object.etag } : null;
    },
  };
}
