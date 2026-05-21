export type CoachInsight = {
  athleteId: string;
  currentFocus: string | null;
  executionScore: number;
  sessionsThisWeek: number;
  transferScore: number;
  recentCompetitionCount: number;
  outcome: "working" | "neutral" | "not_working" | "unknown";
  consistencyScore: number;
  attentionLevel: "high" | "medium" | "low";
  reason: string;
};

function normalizeOutcome(outcome: string | null): CoachInsight["outcome"] {
  if (!outcome) return "unknown";

  if (
    outcome === "working" ||
    outcome === "neutral" ||
    outcome === "not_working" ||
    outcome === "unknown"
  ) {
    return outcome;
  }

  if (outcome === "hit" || outcome === "on_track") return "working";
  if (outcome === "close" || outcome === "developing") return "neutral";
  if (outcome === "not_yet") return "not_working";

  return "unknown";
}

function focusTitle(weeklyFocus: any | null): string | null {
  const title = typeof weeklyFocus?.title === "string" ? weeklyFocus.title.trim() : "";
  return title || null;
}

function normalizeSparringApplication(
  weeklyFocus: any | null,
): "not_yet" | "sometimes" | "yes" | "no_data" {
  const value =
    typeof weeklyFocus?.sparringApplication === "string"
      ? weeklyFocus.sparringApplication.trim()
      : "";

  if (value === "not_yet" || value === "sometimes" || value === "yes") {
    return value;
  }

  return "no_data";
}

function sparringTransferScore(
  sparring: "not_yet" | "sometimes" | "yes" | "no_data",
): number | null {
  switch (sparring) {
    case "not_yet":
      return 0;
    case "sometimes":
      return 0.5;
    case "yes":
      return 1;
    case "no_data":
      return null;
  }
}

function hasNegativeCompetitionOutcome(competitions: any[]): boolean {
  return competitions.some((competition) => {
    const result =
      typeof competition?.result === "string"
        ? competition.result.trim().toLowerCase()
        : "";
    if (["loss", "lost", "dnf", "participated", "other"].includes(result)) {
      return true;
    }

    const matchResult =
      typeof competition?.matchResult === "string"
        ? competition.matchResult.trim().toLowerCase()
        : "";
    if (matchResult === "loss") return true;

    const matches = Array.isArray(competition?.matches) ? competition.matches : [];
    return matches.some((match: any) => {
      const result =
        typeof match?.matchResult === "string"
          ? match.matchResult.trim().toLowerCase()
          : "";
      return result === "loss";
    });
  });
}

export function computeCoachInsight(params: {
  athleteId: string;
  sessions: any[];
  /** Proof-aware current-week count; falls back to `sessions.length` when omitted. */
  sessionsThisWeek?: number;
  competitions: any[];
  weeklyFocus: any | null;
  outcome: string | null;
}): CoachInsight {
  const sessionsThisWeek = params.sessionsThisWeek ?? params.sessions.length;
  const clamp01 = (score: number) => Math.min(Math.max(score, 0), 1);

  const executionScore = clamp01(
    sessionsThisWeek <= 1 ? 0 : sessionsThisWeek <= 3 ? 0.5 : 1,
  );
  const recentCompetitionCount = params.competitions.length;
  const outcome = normalizeOutcome(params.outcome);
  const currentFocus = focusTitle(params.weeklyFocus);
  const appliedInSparring = normalizeSparringApplication(params.weeklyFocus);
  const transferScore = sparringTransferScore(appliedInSparring);
  const consistencyScore = clamp01(executionScore);

  let attentionLevel: CoachInsight["attentionLevel"];
  let reason: string;

  switch (appliedInSparring) {
    case "not_yet":
      attentionLevel = "high";
      reason = "Not showing up in sparring yet.";
      break;
    case "sometimes":
      attentionLevel = "medium";
      reason = "Showing up inconsistently in sparring.";
      break;
    case "yes":
      attentionLevel = "low";
      reason = "Consistently showing up in sparring.";
      break;
    case "no_data":
      attentionLevel = "medium";
      reason = "No sparring data available yet.";
      break;
  }

  if (recentCompetitionCount > 0) {
    if (appliedInSparring === "yes" && hasNegativeCompetitionOutcome(params.competitions)) {
      reason += " Needs validation under competition conditions.";
    } else if (appliedInSparring === "not_yet") {
      reason += " Not appearing in sparring or competition yet.";
    }
  }

  return {
    athleteId: params.athleteId,
    currentFocus,
    executionScore,
    sessionsThisWeek,
    transferScore: transferScore as CoachInsight["transferScore"],
    recentCompetitionCount,
    outcome,
    consistencyScore,
    attentionLevel,
    reason,
  };
}
