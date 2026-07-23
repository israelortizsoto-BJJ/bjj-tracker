/**
 * Environment-local production-media storage binding identity.
 *
 * `"MEDIA"` is the Wrangler R2 binding name inside the executing coach-sync-worker
 * environment. It is not a cross-environment authority and must never collide with
 * proof isolation (`PROOF_MEDIA`).
 */

export const PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING = "MEDIA" as const;

/** Proof-package binding — never admit production verification under this identity. */
export const PROOF_MEDIA_STORAGE_BUCKET_BINDING = "PROOF_MEDIA" as const;

export type ProductionMediaStorageBucketBinding =
  typeof PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING;

export function isProductionMediaStorageBucketBinding(
  value: string,
): value is ProductionMediaStorageBucketBinding {
  return value === PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING;
}

export function assertProductionMediaStorageBucketBinding(
  value: string,
): asserts value is ProductionMediaStorageBucketBinding {
  if (!isProductionMediaStorageBucketBinding(value)) {
    throw new Error(
      `Production verification admits only storageBucketBinding "${PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING}"; received ${JSON.stringify(value)}.`,
    );
  }
}

export function rejectProofMediaStorageBucketBinding(value: string): void {
  if (value === PROOF_MEDIA_STORAGE_BUCKET_BINDING) {
    throw new Error(
      `storageBucketBinding "${PROOF_MEDIA_STORAGE_BUCKET_BINDING}" is isolated to the proof package and cannot be admitted on the production path.`,
    );
  }
}
