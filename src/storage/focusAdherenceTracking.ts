import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bjj.focusAdherence.log.v1";

export type FocusAdherenceValue = "yes" | "somewhat" | "no";

export type FocusAdherenceEntry = {
  athleteId: string;
  sessionId: string;
  system: string;
  adherence: FocusAdherenceValue;
  loggedAtMs: number;
};

type LogArgs = {
  athleteId: string;
  sessionId: string;
  system: string;
  adherence: FocusAdherenceValue;
};

function sanitizeEntry(raw: unknown): FocusAdherenceEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const athleteId = typeof r.athleteId === "string" ? r.athleteId.trim() : "";
  const sessionId = typeof r.sessionId === "string" ? r.sessionId.trim() : "";
  const system = typeof r.system === "string" ? r.system.trim() : "";
  const a = r.adherence;
  const adherence: FocusAdherenceValue | null =
    a === "yes" || a === "somewhat" || a === "no" ? a : null;
  const loggedAtMs =
    typeof r.loggedAtMs === "number" && Number.isFinite(r.loggedAtMs)
      ? r.loggedAtMs
      : 0;
  if (!athleteId || !sessionId || !system || !adherence) return null;
  return { athleteId, sessionId, system, adherence, loggedAtMs };
}

async function readLog(): Promise<FocusAdherenceEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: FocusAdherenceEntry[] = [];
    for (const row of parsed) {
      const n = sanitizeEntry(row);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

async function writeLog(entries: FocusAdherenceEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function logFocusAdherence(args: LogArgs): Promise<void> {
  const athleteId = args.athleteId.trim();
  const sessionId = args.sessionId.trim();
  const system = args.system.trim();
  if (!athleteId || !sessionId || !system) return;

  const prev = await readLog();
  const nextEntry: FocusAdherenceEntry = {
    athleteId,
    sessionId,
    system,
    adherence: args.adherence,
    loggedAtMs: Date.now(),
  };
  await writeLog([...prev, nextEntry]);
}
