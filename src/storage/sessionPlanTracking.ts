import AsyncStorage from "@react-native-async-storage/async-storage";

import { logKeyRead, logKeyWrite } from "../dev/persistenceAudit";
import type {
  GeneratedSessionPlan,
  SessionPlanExposureLevel,
} from "@/src/lib/training/generateSessionPlan";

const KEY = "bjj.session.activePlan.v1";

export type ActiveSessionPlanPayload = {
  system: string;
  exposureLevel: SessionPlanExposureLevel;
  plan: GeneratedSessionPlan;
};

type PlanMap = Record<string, ActiveSessionPlanPayload>;

function normalizeSessionPlan(raw: unknown): GeneratedSessionPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const focus = typeof r.focus === "string" ? r.focus.trim() : "";
  const stepsRaw = r.steps;
  if (!title || !focus) return null;
  if (!Array.isArray(stepsRaw)) return null;
  const steps = stepsRaw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (steps.length === 0) return null;
  return { title, steps, focus };
}

function normalizeExposureLevel(
  raw: unknown,
): SessionPlanExposureLevel | null {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return null;
}

function normalizePayload(raw: unknown): ActiveSessionPlanPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const systemRaw = r.system;
  const system = typeof systemRaw === "string" ? systemRaw.trim() : "";
  if (!system) return null;
  const exposureLevel = normalizeExposureLevel(r.exposureLevel);
  if (!exposureLevel) return null;
  const plan = normalizeSessionPlan(r.plan);
  if (!plan) return null;
  return { system, exposureLevel, plan };
}

async function readMap(): Promise<PlanMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    logKeyRead({
      key: KEY,
      raw,
      source: "sessionPlanTracking.readMap",
    });
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PlanMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = k.trim();
      if (!id) continue;
      const n = normalizePayload(v);
      if (n) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeMap(next: PlanMap): Promise<void> {
  if (Object.keys(next).length === 0) {
    logKeyWrite({
      key: KEY,
      raw: null,
      source: "sessionPlanTracking.writeMap",
      extra: { operation: "removeItem" },
    });
    await AsyncStorage.removeItem(KEY);
    return;
  }
  const raw = JSON.stringify(next);
  logKeyWrite({
    key: KEY,
    raw,
    source: "sessionPlanTracking.writeMap",
    extra: { athleteCount: Object.keys(next).length },
  });
  await AsyncStorage.setItem(KEY, raw);
}

export async function setActiveSessionPlan(
  athleteId: string,
  payload: ActiveSessionPlanPayload,
): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const prev = await readMap();
  await writeMap({
    ...prev,
    [id]: {
      system: payload.system.trim(),
      exposureLevel: payload.exposureLevel,
      plan: payload.plan,
    },
  });
}

export async function getActiveSessionPlan(
  athleteId: string,
): Promise<ActiveSessionPlanPayload | null> {
  const id = athleteId.trim();
  if (!id) return null;
  const prev = await readMap();
  const entry = prev[id];
  if (!entry) return null;
  return entry;
}

export async function clearActiveSessionPlan(athleteId: string): Promise<void> {
  const id = athleteId.trim();
  if (!id) return;
  const prev = await readMap();
  if (!(id in prev)) return;
  const next = { ...prev };
  delete next[id];
  await writeMap(next);
}
