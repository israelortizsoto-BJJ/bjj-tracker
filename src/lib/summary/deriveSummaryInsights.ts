import type { CoachSignalsAggregate } from "@/src/lib/identity/deriveCoachSignals";

export type SummaryInputs = {
  signals: any | null;
  identityScore: number;
  phase: "cold" | "developing" | "experienced";
  identityFocus?: string | null;
  sessions?: any[];
  coachSignals?: CoachSignalsAggregate | null;
};

export type SummaryInsights = {
  focus: string | null;
  focusMode: "identity" | "blended" | "signals";
  trend: "improving" | "stable" | "developing" | "none";
  trendFeedback: string | null;
  postSessionFeedback: string | null;
};

export type SummaryTrend = SummaryInsights["trend"];

/** Single-source trend classification (exported for surfaces that only need trend, without duplicating thresholds). */
export function deriveTrend(signals: any | null): SummaryTrend {
  if (!signals || signals.isIdentityBased || signals.hasData !== true) {
    return "none";
  }

  const confidence = signals.confidenceScore ?? signals.confidence ?? 0;
  const alignment = signals.alignmentScore ?? signals.alignment ?? 0;

  if (confidence > alignment + 10) return "improving";
  if (Math.abs(confidence - alignment) < 10) return "stable";
  if (confidence < alignment) return "developing";

  return "none";
}

function extractSessionFocus(session: any): string | null {
  if (!session) return null;

  const systems = session?.systems ?? [];
  const techniques = session?.techniques ?? [];

  const sysFirst = systems[0];
  if (sysFirst != null && String(sysFirst).trim()) return String(sysFirst).trim();

  const techFirst = techniques[0];
  if (techFirst != null && typeof techFirst === "object") {
    const tid = String((techFirst as { techniqueId?: string }).techniqueId ?? "").trim();
    if (tid) return tid;
    const t = String((techFirst as { technique?: string }).technique ?? "").trim();
    if (t) return t;
    const c = String((techFirst as { customTechnique?: string }).customTechnique ?? "").trim();
    if (c) return c;
  } else if (techFirst != null && String(techFirst).trim()) {
    return String(techFirst).trim();
  }

  const legSys = String(session.system ?? "").trim();
  if (legSys && legSys.toUpperCase() !== "ALL") return legSys;
  const legTech = String(session.technique ?? "").trim();
  if (legTech) return legTech;

  return null;
}

function formatLabel(value: string | null | undefined): string | null {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
}

function derivePostSessionFeedback(
  session: any,
  trend: SummaryTrend,
): string | null {
  const focus = extractSessionFocus(session);
  if (!focus) return null;

  const label = formatLabel(focus);
  if (!label) return null;

  if (trend === "improving") {
    return `Your ${label} is becoming more consistent. Keep reinforcing it.`;
  }

  if (trend === "stable") {
    return `Solid work. Focus on sharpening your ${label} under resistance.`;
  }

  if (trend === "developing") {
    return `Good reps. Keep building consistency around your ${label}.`;
  }

  return `Continue building your ${label}.`;
}

function coachWeaknessSystemKey(
  aggregate: CoachSignalsAggregate | null | undefined,
): string | null {
  if (!aggregate) return null;
  const sortedSystems = Object.keys(aggregate).sort((a, b) => a.localeCompare(b));

  let bestKey: string | null = null;
  let bestW = -Infinity;

  for (const system of sortedSystems) {
    const w = aggregate[system]?.weakness ?? 0;
    if (w > bestW) {
      bestW = w;
      bestKey = system;
    }
  }

  return bestW > 0 ? bestKey : null;
}

function coachWeaknessFocusAccent(
  baseFocus: string | null | undefined,
  coachSignals: CoachSignalsAggregate | null | undefined,
): string | null {
  const base = typeof baseFocus === "string" ? baseFocus.trim() : "";

  const systemKey = coachWeaknessSystemKey(coachSignals);
  if (!systemKey) {
    return base.length ? base : null;
  }

  const lbl = formatLabel(systemKey);
  if (!lbl) {
    return base.length ? base : null;
  }

  const accent = `Competition notes highlight ${lbl} as a weakness to address.`;
  return base.length ? `${accent} ${base}` : accent;
}

function deriveFocus({
  signals,
  identityFocus,
  sessions,
  coachSignals,
}: {
  signals: any | null;
  identityFocus?: string | null;
  sessions?: any[];
  coachSignals?: CoachSignalsAggregate | null;
}): { mode: SummaryInsights["focusMode"]; focus: string | null } {
  const hasRealData = signals?.hasData === true;
  const sessionCount = sessions?.length ?? 0;

  const signalFocus =
    signals?.patterns?.topSystem ||
    signals?.patterns?.topTechnique ||
    signals?.systems?.topSystem ||
    null;

  const idFocus = identityFocus ?? null;

  const coachAgg = coachSignals ?? null;

  /** Coach notes only tweak focus when session-derived patterns are absent. */
  const identityBackedFocus = (): string | null =>
    coachWeaknessFocusAccent(idFocus, coachAgg) ?? idFocus ?? null;

  if (!hasRealData || sessionCount === 0) {
    return { mode: "identity", focus: identityBackedFocus() };
  }

  if (sessionCount < 10) {
    if (signalFocus) {
      const sigLbl = formatLabel(signalFocus);
      return {
        mode: "blended",
        focus: `You're starting to build patterns around ${sigLbl ?? signalFocus}. ${idFocus}`,
      };
    }

    return { mode: "blended", focus: identityBackedFocus() };
  }

  if (signalFocus) {
    const sigLbl = formatLabel(signalFocus);
    return {
      mode: "signals",
      focus: `Continue building your game around ${sigLbl ?? signalFocus} and refine your execution.`,
    };
  }

  return { mode: "signals", focus: identityBackedFocus() };
}

export function deriveSummaryInsights(inputs: SummaryInputs): SummaryInsights {
  const { signals, identityFocus, sessions, coachSignals } = inputs;

  const trend = deriveTrend(signals);

  const focusResult = deriveFocus({
    signals,
    identityFocus,
    sessions,
    coachSignals: coachSignals ?? null,
  });

  const latestSession = sessions?.[0] ?? null;

  const postSessionFeedback =
    signals?.hasData === true
      ? derivePostSessionFeedback(latestSession, trend)
      : null;

  let trendFeedback: string | null = null;

  if (trend === "improving") {
    trendFeedback =
      "Your consistency is improving. Keep reinforcing what's working.";
  } else if (trend === "stable") {
    trendFeedback =
      "Your game is stabilizing. Focus on tightening execution.";
  } else if (trend === "developing") {
    trendFeedback =
      "You're still building consistency. Keep logging sessions.";
  }

  return {
    focus: focusResult.focus,
    focusMode: focusResult.mode,
    trend,
    trendFeedback,
    postSessionFeedback,
  };
}
