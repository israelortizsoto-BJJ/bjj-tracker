import type { ConditionalObjectStore } from "./conditionalObjectStore.ts";
import type {
  VerificationRecordStore,
  VersionedValue,
} from "./verificationRecordStore.ts";

/**
 * Repository-native durable VerificationRecordStore adapter.
 *
 * Maps putIfAbsent / getVersioned / compareAndSwap onto the same R2 ETag
 * conditional-put pattern established in coach-sync-worker/src/index.ts for
 * upload intent/session metadata. Persistence atomicity is the conditional
 * object's onlyIf primitive — not an in-process mutex or per-key async queue.
 *
 * Unwired: requires an injected ConditionalObjectStore. Does not touch
 * production buckets, credentials, deployment bindings, or worker routes.
 */
export function createConditionalObjectVerificationRecordStore(
  objects: ConditionalObjectStore,
): VerificationRecordStore {
  return {
    get: async (key) => {
      const object = await objects.get(key);
      return object ? object.body : null;
    },
    putIfAbsent: async (key, value) => {
      const object = await objects.put(key, value, {
        onlyIf: { etagDoesNotMatch: "*" },
      });
      return object !== null;
    },
    getVersioned: async (key): Promise<VersionedValue | null> => {
      const object = await objects.get(key);
      return object ? { value: object.body, version: object.etag } : null;
    },
    compareAndSwap: async (key, version, value) => {
      const object = await objects.put(key, value, {
        onlyIf: { etagMatches: version },
      });
      return object !== null;
    },
  };
}
