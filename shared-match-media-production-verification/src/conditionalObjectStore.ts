/**
 * Injected conditional-object capability shaped like Cloudflare R2 JSON + ETag CAS
 * as used by coach-sync-worker Shared Match Media upload metadata:
 *   put(..., { onlyIf: { etagDoesNotMatch: "*" } })  // create-if-absent
 *   put(..., { onlyIf: { etagMatches: version } })   // compare-and-swap
 *   get → body + etag
 *
 * This module does not bind a production MEDIA R2 bucket, alter deployment
 * configuration, or register any runtime composition root. Callers must inject a
 * capability (production conditional-object store later, or a local synthetic
 * conditional-object backend in tests).
 */

export type ConditionalPutOnlyIf =
  | { readonly etagDoesNotMatch: "*" }
  | { readonly etagMatches: string };

export type ConditionalObjectGetResult = {
  readonly body: string;
  readonly etag: string;
};

export type ConditionalObjectPutResult = {
  readonly etag: string;
};

/**
 * Minimal R2-compatible conditional object surface for verification-record durability.
 * Matches the upload worker's onlyIf semantics; not a general R2 client.
 */
export type ConditionalObjectStore = {
  get(key: string): Promise<ConditionalObjectGetResult | null>;
  put(
    key: string,
    value: string,
    options: { readonly onlyIf: ConditionalPutOnlyIf },
  ): Promise<ConditionalObjectPutResult | null>;
};
