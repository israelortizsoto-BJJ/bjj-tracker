import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";

export type SharedMatchMediaUploadRecord = {
  schemaVersion: 1;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  matchMediaAssetId: string;
  objectVersion: string;
  uploadSessionId: string;
  /** Explicit upload intake completion — not verified, published, or playable. */
  status: "upload_complete";
  completedByteCount: number;
  completedAt: string;
  declaredMimeType: string;
  declaredByteCount: number;
  /** Device-local source retained only where locally necessary. */
  localSourceUri: string;
  recordedAt: string;
};

type StoreShape = {
  schemaVersion: 1;
  byLineageKey: Record<string, SharedMatchMediaUploadRecord>;
};

function lineageKey(
  sharedAthleteId: string,
  sharedCompetitionId: string,
  matchLineageKey: string,
): string {
  return `${sharedAthleteId.trim()}\u0000${sharedCompetitionId.trim()}\u0000${matchLineageKey.trim()}`;
}

async function readStore(): Promise<StoreShape> {
  const raw = await AsyncStorage.getItem(StorageKeys.sharedMatchMediaUploadsByLineage);
  if (!raw) return { schemaVersion: 1, byLineageKey: {} };
  try {
    const parsed = JSON.parse(raw) as StoreShape;
    if (parsed?.schemaVersion !== 1 || !parsed.byLineageKey || typeof parsed.byLineageKey !== "object") {
      return { schemaVersion: 1, byLineageKey: {} };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, byLineageKey: {} };
  }
}

export async function getSharedMatchMediaUploadRecord(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
}): Promise<SharedMatchMediaUploadRecord | null> {
  const store = await readStore();
  return store.byLineageKey[lineageKey(input.sharedAthleteId, input.sharedCompetitionId, input.matchLineageKey)] ?? null;
}

/**
 * Persist upload_complete identity only after successful foundation completion.
 * Never records verification or publication state.
 */
export async function putSharedMatchMediaUploadComplete(
  record: Omit<SharedMatchMediaUploadRecord, "schemaVersion" | "status" | "recordedAt"> & {
    recordedAt?: string;
  },
): Promise<SharedMatchMediaUploadRecord> {
  const next: SharedMatchMediaUploadRecord = {
    schemaVersion: 1,
    sharedAthleteId: record.sharedAthleteId.trim(),
    sharedCompetitionId: record.sharedCompetitionId.trim(),
    matchLineageKey: record.matchLineageKey.trim(),
    matchMediaAssetId: record.matchMediaAssetId.trim(),
    objectVersion: record.objectVersion.trim(),
    uploadSessionId: record.uploadSessionId.trim(),
    status: "upload_complete",
    completedByteCount: record.completedByteCount,
    completedAt: record.completedAt.trim(),
    declaredMimeType: record.declaredMimeType.trim(),
    declaredByteCount: record.declaredByteCount,
    localSourceUri: record.localSourceUri.trim(),
    recordedAt: record.recordedAt?.trim() || new Date().toISOString(),
  };
  if (
    !next.sharedAthleteId ||
    !next.sharedCompetitionId ||
    !next.matchLineageKey ||
    !next.matchMediaAssetId ||
    !next.objectVersion ||
    !next.uploadSessionId ||
    !next.completedAt ||
    !next.declaredMimeType ||
    !next.localSourceUri ||
    !Number.isSafeInteger(next.completedByteCount) ||
    !Number.isSafeInteger(next.declaredByteCount)
  ) {
    throw new Error("Incomplete Shared Match Media upload_complete record.");
  }
  const store = await readStore();
  store.byLineageKey[lineageKey(next.sharedAthleteId, next.sharedCompetitionId, next.matchLineageKey)] =
    next;
  await AsyncStorage.setItem(
    StorageKeys.sharedMatchMediaUploadsByLineage,
    JSON.stringify(store),
  );
  return next;
}
