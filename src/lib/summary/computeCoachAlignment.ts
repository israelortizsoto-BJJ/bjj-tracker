import type { SignalOutput } from "@/src/lib/signals/computeSignals";

export type CoachAlignmentResult = {
  status: "no_focus" | "directed_no_proof" | "misaligned" | "aligned" | "validated";
  reason: string;
  matchesTraining: boolean;
  hasData: boolean;
  isExposed: boolean;
};

type CoachAlignmentInput = {
  signals: SignalOutput;
  exposurePending?: any | null;
  /** Output of `selectFocusSystem` (coach system key, else identity, else signal top system). */
  resolvedFocusSystem: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function topSystemFromSignals(signals: unknown): string | null {
  const s = signals as {
    patterns?: { topSystem?: string | null } | null;
    systems?: { topSystem?: string | null } | null;
  } | null;

  const patternTop = s?.patterns?.topSystem?.trim();
  if (patternTop) return patternTop;

  const systemTop = s?.systems?.topSystem?.trim();
  return systemTop || null;
}

function competitionCountFromSignals(signals: unknown): number {
  const s = signals as {
    competition?: { competitionCount?: number | null } | null;
  } | null;
  const count = s?.competition?.competitionCount;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

export function computeCoachAlignment(
  input: CoachAlignmentInput,
): CoachAlignmentResult {
  const focus = input.resolvedFocusSystem?.trim() || null;
  const hasData = input.signals.hasData === true;
  const isExposed = Boolean(input.exposurePending);
  const topSystem = topSystemFromSignals(input.signals);

  if (!focus) {
    return {
      status: "no_focus",
      reason: "No structured coach focus is set.",
      matchesTraining: false,
      hasData,
      isExposed,
    };
  }

  if (!topSystem) {
    return {
      status: "directed_no_proof",
      reason: "Coach direction is set, but no matching training proof has been logged yet.",
      matchesTraining: false,
      hasData,
      isExposed,
    };
  }

  const matchesTraining =
    normalize(topSystem) === normalize(focus);

  if (!matchesTraining) {
    return {
      status: "misaligned",
      reason: "Training does not match the coach focus.",
      matchesTraining,
      hasData,
      isExposed,
    };
  }

  if (isExposed) {
    return {
      status: "aligned",
      reason: "Training matches the coach focus.",
      matchesTraining,
      hasData,
      isExposed,
    };
  }

  if (competitionCountFromSignals(input.signals) > 0) {
    return {
      status: "validated",
      reason: "Training matches the coach focus and has competition proof.",
      matchesTraining,
      hasData,
      isExposed,
    };
  }

  return {
    status: "aligned",
    reason: "Training matches the coach focus.",
    matchesTraining,
    hasData,
    isExposed,
  };
}
