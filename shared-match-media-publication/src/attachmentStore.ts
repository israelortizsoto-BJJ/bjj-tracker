import type { MatchAttachmentIdentity } from "./attachmentTypes.ts";

export type VersionedAttachmentValue = {
  readonly value: string;
  readonly version: string;
};

/**
 * Authoritative persistence boundary for one canonical attachment per Match.
 */
export type MatchMediaAttachmentRecordStore = {
  getVersioned(key: string): Promise<VersionedAttachmentValue | null>;
  putIfAbsent(key: string, value: string): Promise<boolean>;
  compareAndSwap(
    key: string,
    version: string,
    value: string,
  ): Promise<boolean>;
};

export type ConditionalPutOnlyIf =
  | { readonly etagDoesNotMatch: "*" }
  | { readonly etagMatches: string };

export type ConditionalObjectStore = {
  get(key: string): Promise<{ readonly body: string; readonly etag: string } | null>;
  put(
    key: string,
    value: string,
    options: { readonly onlyIf: ConditionalPutOnlyIf },
  ): Promise<{ readonly etag: string } | null>;
};

function encodeIdentityPart(value: string): string {
  return encodeURIComponent(value.trim());
}

export function attachmentRecordKey(identity: MatchAttachmentIdentity): string {
  return [
    "shared-match-media",
    "attachments",
    encodeIdentityPart(identity.sharedAthleteId),
    encodeIdentityPart(identity.sharedCompetitionId),
    `${encodeIdentityPart(identity.matchLineageKey)}.json`,
  ].join("/");
}

/**
 * Maps the Publication record store onto repository-native conditional-object
 * ETag semantics. The capability is injected; this module binds no bucket.
 */
export function createConditionalObjectAttachmentRecordStore(
  objects: ConditionalObjectStore,
): MatchMediaAttachmentRecordStore {
  return {
    getVersioned: async (key) => {
      const object = await objects.get(key);
      return object ? { value: object.body, version: object.etag } : null;
    },
    putIfAbsent: async (key, value) => {
      const object = await objects.put(key, value, {
        onlyIf: { etagDoesNotMatch: "*" },
      });
      return object !== null;
    },
    compareAndSwap: async (key, version, value) => {
      const object = await objects.put(key, value, {
        onlyIf: { etagMatches: version },
      });
      return object !== null;
    },
  };
}
