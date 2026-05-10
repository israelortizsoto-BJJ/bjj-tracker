import type { SignalOutput } from "@/src/lib/signals/computeSignals";

export type CoachAlignmentResult = {
  status: "no_focus" | "no_data" | "misaligned" | "aligned" | "validated";
  reason: string;
  matchesTraining: boolean;
  hasData: boolean;
  isExposed: boolean;
};

type CoachAlignmentInput = {
  coachWeekly?: {
    headline: string;
  } | null;
  signals: SignalOutput;
  exposurePending?: any | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function computeCoachAlignment(
  input: CoachAlignmentInput,
): CoachAlignmentResult {
  const coachFocus = input.coachWeekly?.headline?.trim() || null;
  const hasData = input.signals.hasData === true;
  const isExposed = Boolean(input.exposurePending);

  if (!coachFocus) {
    return {
      status: "no_focus",
      reason: "No coach focus is set.",
      matchesTraining: false,
      hasData,
      isExposed,
    };
  }

  if (!hasData) {
    return {
      status: "no_data",
      reason: "No training data yet.",
      matchesTraining: false,
      hasData,
      isExposed,
    };
  }

  const matchesTraining =
    normalize(input.signals.patterns.topSystem) === normalize(coachFocus);

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

  if (input.signals.competition.competitionCount > 0) {
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
