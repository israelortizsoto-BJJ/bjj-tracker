import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  COMPETITION_STATE_AUDITOR_RING_MAX,
  COMPETITION_STATE_AUDITOR_RING_STORAGE_KEY,
  type CompetitionStateAuditorRingRecord,
  type CompetitionStateSnapshot,
} from "./competitionStateAuditorContract";

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let storageOverride: StorageAdapter | null = null;

/** Test-only hook to avoid AsyncStorage in unit tests. */
export function __setCompetitionStateAuditorRingStorageForTests(
  adapter: StorageAdapter | null,
): void {
  storageOverride = adapter;
}

async function getStorage(): Promise<StorageAdapter> {
  if (storageOverride) return storageOverride;
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return AsyncStorage;
}

function emptyRing(): CompetitionStateAuditorRingRecord {
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    updatedAt: new Date().toISOString(),
    snapshots: [],
  };
}

export async function loadCompetitionStateAuditorRing(): Promise<CompetitionStateAuditorRingRecord> {
  try {
    const storage = await getStorage();
    const raw = await storage.getItem(COMPETITION_STATE_AUDITOR_RING_STORAGE_KEY);
    if (!raw) return emptyRing();
    const parsed = JSON.parse(raw) as Partial<CompetitionStateAuditorRingRecord>;
    if (!Array.isArray(parsed.snapshots)) return emptyRing();
    return {
      contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      snapshots: parsed.snapshots as CompetitionStateSnapshot[],
    };
  } catch {
    return emptyRing();
  }
}

export async function appendCompetitionStateSnapshot(
  snapshot: CompetitionStateSnapshot,
): Promise<CompetitionStateAuditorRingRecord> {
  const ring = await loadCompetitionStateAuditorRing();
  const snapshots = [...ring.snapshots, snapshot].slice(-COMPETITION_STATE_AUDITOR_RING_MAX);
  const next: CompetitionStateAuditorRingRecord = {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    updatedAt: new Date().toISOString(),
    snapshots,
  };
  const storage = await getStorage();
  await storage.setItem(COMPETITION_STATE_AUDITOR_RING_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearCompetitionStateAuditorRing(): Promise<void> {
  const storage = await getStorage();
  await storage.setItem(
    COMPETITION_STATE_AUDITOR_RING_STORAGE_KEY,
    JSON.stringify(emptyRing()),
  );
}

/** Fire-and-forget ring append — never blocks competition mutations. */
export function persistCompetitionStateSnapshot(snapshot: CompetitionStateSnapshot): void {
  void appendCompetitionStateSnapshot(snapshot).catch(() => {
    // Auditor persistence must never surface errors to competition flows.
  });
}
