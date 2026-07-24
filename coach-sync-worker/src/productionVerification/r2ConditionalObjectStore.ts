/**
 * Thin ConditionalObjectStore adapter over the coach-sync-worker MEDIA R2 binding.
 * Maps JSON + ETag conditional puts for durable records (Verification, Publication).
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

export type R2ConditionalObjectStoreOptions = {
  readonly recordType?: string;
};

export function createR2ConditionalObjectStore(
  bucket: R2ConditionalBucket,
  options?: R2ConditionalObjectStoreOptions,
): ConditionalObjectStore {
  const recordType = options?.recordType ?? "production-verification-record-v1";
  return {
    get: async (key) => {
      const object = await bucket.get(key);
      if (!object) return null;
      return { body: await object.text(), etag: object.etag };
    },
    put: async (key, value, putOptions) => {
      const object = await bucket.put(key, value, {
        onlyIf: putOptions.onlyIf,
        httpMetadata: { contentType: "application/json" },
        customMetadata: { recordType },
      });
      return object ? { etag: object.etag } : null;
    },
  };
}
