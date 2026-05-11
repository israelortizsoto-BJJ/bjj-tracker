import AsyncStorage from "@react-native-async-storage/async-storage";

/** Legacy: athlete-only (stale across weeks / systems). Never read after v2. */
const LEGACY_KEY_PREFIX = "mm:v1:summary:lastAction:";

/** Scoped: athlete + weekly window + coach system routing. */
const SCOPED_KEY_PREFIX = "mm:v1:summary:lastAction:v2:";

function normalizeScopeSegment(raw: string | null | undefined): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return "none";
  return t.toLowerCase().replace(/\s+/g, "_");
}

function scopedStorageKey(
  athleteId: string,
  weekStartYMD: string | null | undefined,
  systemKey: string | null | undefined,
): string {
  const week =
    typeof weekStartYMD === "string" && weekStartYMD.trim()
      ? weekStartYMD.trim()
      : "none";
  const sys = normalizeScopeSegment(systemKey);
  return `${SCOPED_KEY_PREFIX}${athleteId}:${week}:${sys}`;
}

function legacyStorageKey(athleteId: string): string {
  return LEGACY_KEY_PREFIX + athleteId;
}

export async function getLastSummaryAction(
  athleteId: string,
  weekStartYMD: string | null | undefined,
  systemKey: string | null | undefined,
): Promise<string | null> {
  if (!athleteId) return null;
  try {
    return await AsyncStorage.getItem(
      scopedStorageKey(athleteId, weekStartYMD, systemKey),
    );
  } catch {
    return null;
  }
}

export async function setLastSummaryAction(
  athleteId: string,
  weekStartYMD: string | null | undefined,
  systemKey: string | null | undefined,
  action: string,
): Promise<void> {
  if (!athleteId || !action) return;
  try {
    await AsyncStorage.setItem(
      scopedStorageKey(athleteId, weekStartYMD, systemKey),
      action,
    );
    try {
      await AsyncStorage.removeItem(legacyStorageKey(athleteId));
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
