export const INCIDENT_CAPTURE_DEBUG_STORAGE_KEY = "mm:v1:incidentCaptureDebug";

export const INCIDENT_CAPTURE_CRASH_ALERT_WINDOW_MS = 5 * 60 * 1000;

export type IncidentCaptureStage =
  | "pre_authority"
  | "post_authority"
  | "pre_hydration"
  | "post_hydration"
  | "pre_worker"
  | "post_worker"
  | "pre_topology"
  | "post_topology"
  | "pre_bundle_assembly"
  | "post_bundle_assembly"
  | "pre_validation"
  | "post_validation"
  | "capture_complete";

export type IncidentCaptureDebugRecord = {
  stage: IncidentCaptureStage;
  at: string;
  correlationId: string;
};

export type PersistCaptureStage = (
  stage: IncidentCaptureStage,
  correlationId: string,
) => Promise<void>;

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let storageOverride: StorageAdapter | null = null;

/** Test-only hook to avoid AsyncStorage in unit tests. */
export function __setIncidentCaptureDebugStorageForTests(
  adapter: StorageAdapter | null,
): void {
  storageOverride = adapter;
}

async function getStorage(): Promise<StorageAdapter> {
  if (storageOverride) return storageOverride;
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return AsyncStorage;
}

export async function loadIncidentCaptureDebugRecord(): Promise<IncidentCaptureDebugRecord | null> {
  try {
    const storage = await getStorage();
    const raw = await storage.getItem(INCIDENT_CAPTURE_DEBUG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IncidentCaptureDebugRecord>;
    if (typeof parsed.stage !== "string" || typeof parsed.at !== "string") return null;
    return {
      stage: parsed.stage as IncidentCaptureStage,
      at: parsed.at,
      correlationId: typeof parsed.correlationId === "string" ? parsed.correlationId : "",
    };
  } catch {
    return null;
  }
}

export async function persistIncidentCaptureStage(
  stage: IncidentCaptureStage,
  correlationId: string,
): Promise<IncidentCaptureDebugRecord> {
  const record: IncidentCaptureDebugRecord = {
    stage,
    at: new Date().toISOString(),
    correlationId,
  };
  const storage = await getStorage();
  await storage.setItem(INCIDENT_CAPTURE_DEBUG_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function formatIncidentCaptureStageReadout(
  record: IncidentCaptureDebugRecord | null,
): string {
  if (!record) return "none";
  return `${record.stage} (${record.at})`;
}

export function isRecentIncompleteCapture(
  record: IncidentCaptureDebugRecord,
): boolean {
  if (record.stage === "capture_complete") return false;
  const atMs = Date.parse(record.at);
  if (Number.isNaN(atMs)) return false;
  return Date.now() - atMs < INCIDENT_CAPTURE_CRASH_ALERT_WINDOW_MS;
}
