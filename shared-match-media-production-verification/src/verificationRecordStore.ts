/**
 * Authoritative persistence boundary for Production Verification records.
 *
 * The durable adapter is createConditionalObjectVerificationRecordStore, which
 * maps this interface onto repository-native R2 JSON + ETag conditional puts
 * (coach-sync-worker upload metadata pattern). Atomic admission must be
 * guaranteed by the injected conditional-object onlyIf primitive.
 *
 * Production MEDIA bucket binding, deployment configuration changes, and runtime
 * composition are intentionally absent. Inject a ConditionalObjectStore capability
 * instead.
 */

export type VersionedValue = {
  readonly value: string;
  readonly version: string;
};

export type VerificationRecordStore = {
  get(key: string): Promise<string | null>;
  putIfAbsent(key: string, value: string): Promise<boolean>;
  getVersioned(key: string): Promise<VersionedValue | null>;
  compareAndSwap(
    key: string,
    version: string,
    value: string,
  ): Promise<boolean>;
};

export function recordStoreKey(admissionKeyHash: string): string {
  return `production-verification/records/${admissionKeyHash}.json`;
}
