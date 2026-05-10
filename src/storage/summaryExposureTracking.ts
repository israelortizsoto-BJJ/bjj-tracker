import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bjj.summary.exposurePending.v1";

/** Pending gaps auto-expire so stale coaching state cannot linger if training stops. */
export const EXPOSURE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

/** Training saves required with stable dominance matching the exposed system before clearing pending. */
export const RECOVERY_MIN_SESSIONS = 2;

export type ExposurePendingPayload = {
  system: string;
  ts: number;
  recoveryCount?: number;
  exposureCount?: number;
};

export type ExposurePressureTier = "low" | "medium" | "high";

/** Pressure tier from repeated exposure while pending (0 counts as low — fading toward resolution). */
export function deriveExposureLevel(exposureCount: number): ExposurePressureTier {
  return exposureCount >= 3 ? "high" : exposureCount === 2 ? "medium" : "low";
}

type PendingMap = Record<string, ExposurePendingPayload>;

function normalizeEntry(raw: unknown): ExposurePendingPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const systemRaw = r.system;
  const systemTrimmed =
    typeof systemRaw === "string" ? (systemRaw.trim() || null) : null;
  if (!systemTrimmed) return null;
  const ts = typeof r.ts === "number" ? r.ts : 0;
  const recoveryCount =
    typeof r.recoveryCount === "number" && Number.isFinite(r.recoveryCount)
      ? Math.max(0, Math.floor(r.recoveryCount))
      : undefined;
  const exposureCount =
    typeof r.exposureCount === "number" && Number.isFinite(r.exposureCount)
      ? Math.max(0, Math.floor(r.exposureCount))
      : undefined;
  const payload: ExposurePendingPayload = { system: systemTrimmed, ts };
  if (recoveryCount !== undefined) payload.recoveryCount = recoveryCount;
  if (exposureCount !== undefined) payload.exposureCount = exposureCount;
  return payload;
}

async function readMap(): Promise<PendingMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PendingMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = k.trim();
      if (!id) continue;
      const n = normalizeEntry(v);
      if (n) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeMap(next: PendingMap): Promise<void> {
  if (Object.keys(next).length === 0) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

/** Persists exposure at save-time; survives until resolved or TTL. */
export async function setPending(
  athleteId: string,
  payload: ExposurePendingPayload,
): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const prev = await readMap();
  const nextEntry: ExposurePendingPayload = {
    system: payload.system.trim(),
    ts: payload.ts,
  };
  if (payload.recoveryCount !== undefined) {
    nextEntry.recoveryCount = payload.recoveryCount;
  }
  if (payload.exposureCount !== undefined) {
    nextEntry.exposureCount = payload.exposureCount;
  }
  await writeMap({
    ...prev,
    [id]: nextEntry,
  });
}

/** Read current pending exposure without consuming (Summary + diagnostics). */
export async function getPending(athleteId: string): Promise<ExposurePendingPayload | null> {
  const id = athleteId.trim();
  if (!id) return null;
  const prev = await readMap();
  const entry = prev[id];
  if (!entry) return null;
  if (Date.now() - entry.ts > EXPOSURE_TTL_MS) {
    const next = { ...prev };
    delete next[id];
    await writeMap(next);
    return null;
  }
  return entry;
}

/** @deprecated Prefer {@link setPending} with explicit timestamp. */
export async function setExposurePendingForAthlete(
  athleteId: string,
  system: string | null,
): Promise<void> {
  const s = typeof system === "string" ? system.trim() : "";
  if (!s) return;
  await setPending(athleteId, {
    system: s,
    ts: Date.now(),
    recoveryCount: 0,
    exposureCount: 1,
  });
}

export async function clearExposurePendingForAthlete(athleteId: string): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const prev = await readMap();
  if (!(id in prev)) return;
  const next = { ...prev };
  delete next[id];
  await writeMap(next);
}

export const clearPending = clearExposurePendingForAthlete;
