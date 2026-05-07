export type SummaryExplanationInputs = {
  identityScore: number;
  phase: "cold" | "developing" | "experienced";
  beltRank?: string | null;
  declaredSkills?: string[] | null;
  sessionCount?: number;
  competitionCount?: number;
  signals?: any | null;
};

export type SummaryExplanation = {
  identityReason: string;
  signalReason: string | null;
  nextAction: string;
};

function deriveIdentityReason({
  identityScore,
  beltRank,
  declaredSkills,
  sessionCount,
  competitionCount,
}: {
  identityScore: number;
  beltRank?: string | null;
  declaredSkills?: string[] | null;
  sessionCount?: number;
  competitionCount?: number;
}): string {
  const skillsCount = declaredSkills?.length ?? 0;

  if (identityScore < 30) {
    return "Your identity is just getting started. It's based mostly on your profile.";
  }

  if (identityScore < 60) {
    return `Your identity is forming through ${skillsCount} recognized skills and early activity.`;
  }

  return `Your identity is well developed through your experience, skills, and training history.`;
}

function deriveSignalReason(signals: any | null): string | null {
  if (!signals || signals.hasData !== true) return null;

  const system =
    signals?.patterns?.topSystem ||
    signals?.patterns?.topTechnique ||
    signals?.systems?.topSystem;

  const format = (s: string | null | undefined) =>
    s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

  if (system) {
    return `Your recent sessions show a pattern around ${format(system)}.`;
  }

  return "Your recent sessions are starting to form patterns.";
}

function deriveNextAction({
  phase,
  trend,
}: {
  phase: "cold" | "developing" | "experienced";
  trend?: string;
}): string {
  if (trend === "improving") {
    return "Keep reinforcing what's working in your training.";
  }

  if (trend === "stable") {
    return "Focus on refining your execution and details.";
  }

  if (trend === "developing") {
    return "Simplify your focus and build consistency.";
  }

  if (phase === "cold") {
    return "Start logging sessions to build your identity.";
  }

  return "Continue training to strengthen your patterns.";
}

export function deriveSummaryExplanation(
  inputs: SummaryExplanationInputs & { trend?: string },
): SummaryExplanation {
  const {
    identityScore,
    phase,
    beltRank,
    declaredSkills,
    sessionCount,
    competitionCount,
    signals,
    trend,
  } = inputs;

  return {
    identityReason: deriveIdentityReason({
      identityScore,
      beltRank,
      declaredSkills,
      sessionCount,
      competitionCount,
    }),
    signalReason: deriveSignalReason(signals),
    nextAction: deriveNextAction({ phase, trend }),
  };
}
