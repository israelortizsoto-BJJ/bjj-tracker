import AsyncStorage from "@react-native-async-storage/async-storage";

import { logKeyRead, logKeyWrite } from "../dev/persistenceAudit";

const KEY = "bjj.focus.active.v1";

export type ActiveFocusPayload = {
  system: string;
};

type FocusMap = Record<string, ActiveFocusPayload>;

function normalizeFocus(raw: unknown): ActiveFocusPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const system = typeof r.system === "string" ? r.system.trim() : "";
  if (!system) return null;
  return { system };
}

async function readMap(): Promise<FocusMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    logKeyRead({
      key: KEY,
      raw,
      source: "focusTracking.readMap",
    });
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: FocusMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = k.trim();
      if (!id) continue;
      const n = normalizeFocus(v);
      if (n) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeMap(next: FocusMap): Promise<void> {
  if (Object.keys(next).length === 0) {
    logKeyWrite({
      key: KEY,
      raw: null,
      source: "focusTracking.writeMap",
      extra: { operation: "removeItem" },
    });
    await AsyncStorage.removeItem(KEY);
    return;
  }
  const raw = JSON.stringify(next);
  logKeyWrite({
    key: KEY,
    raw,
    source: "focusTracking.writeMap",
    extra: { athleteCount: Object.keys(next).length },
  });
  await AsyncStorage.setItem(KEY, raw);
}

export async function setActiveFocus(
  athleteId: string,
  payload: ActiveFocusPayload,
): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const system = payload.system.trim();
  if (!system) return;
  const prev = await readMap();
  await writeMap({
    ...prev,
    [id]: { system },
  });
}

export async function getActiveFocus(athleteId: string): Promise<ActiveFocusPayload | null> {
  const id = athleteId.trim();
  if (!id) return null;
  const prev = await readMap();
  const entry = prev[id];
  if (!entry) return null;
  return entry;
}

export async function clearActiveFocus(athleteId: string): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const prev = await readMap();
  if (!(id in prev)) return;
  const next = { ...prev };
  delete next[id];
  await writeMap(next);
}
