import { deriveSummaryExplanation } from "@/src/lib/summary/deriveSummaryExplanation";
import {
  deriveSummaryInsights,
  type SummaryInputs,
  type SummaryInsights,
} from "@/src/lib/summary/deriveSummaryInsights";
import { computeCoachAlignment } from "@/src/lib/summary/computeCoachAlignment";
import { computeProgression } from "@/src/lib/summary/computeProgression";
import { resolveIdentityState } from "@/src/lib/summary/resolveIdentityState";
import { formatActionByIdentity } from "@/src/lib/summary/formatActionByIdentity";
import { selectFocusSystem } from "@/src/lib/summary/selectFocusSystem";

export type SummaryViewModel = {
  focus: string;
  action: string;
  progress: string;
  why: string;
  stepKey?: string;
};

export type BuildSummaryViewModelInput = SummaryInputs & {
  beltRank?: string | null;
  declaredSkills?: string[] | null;
  sessionCount?: number;
  competitionCount?: number;
  coachWeekly?: {
    headline: string;
    body?: string;
  } | null;
  exposurePending?: any | null;
  lastAction?: string | null;
};

type SignalSnapshot = {
  hasData: boolean;
  topSystem: string | null;
  topTechnique: string | null;
};

function extractSignalSnapshot(raw: unknown): SignalSnapshot {
  const s = raw as {
    hasData?: boolean;
    patterns?: {
      topSystem?: string | null;
      topTechnique?: string | null;
    } | null;
    systems?: { topSystem?: string | null } | null;
  } | null;

  if (!s || s.hasData !== true) {
    return { hasData: false, topSystem: null, topTechnique: null };
  }

  const p = s.patterns ?? null;
  const topSystem =
    typeof p?.topSystem === "string" && p.topSystem.trim()
      ? p.topSystem.trim()
      : typeof s.systems?.topSystem === "string" && s.systems.topSystem.trim()
        ? s.systems.topSystem.trim()
        : null;

  const topTechnique =
    typeof p?.topTechnique === "string" && p.topTechnique.trim()
      ? p.topTechnique.trim()
      : null;

  return { hasData: true, topSystem, topTechnique };
}

function normKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatDisplay(raw: string): string {
  const tail = raw.split(".").pop() ?? raw;
  return tail
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function buildFocusLine(
  snap: SignalSnapshot,
  identityFocus?: string | null,
  coachSystem?: string | null,
): string {
  if (coachSystem) return coachSystem;

  const sys = snap.topSystem ? formatDisplay(snap.topSystem) : "";
  const tech = snap.topTechnique ? formatDisplay(snap.topTechnique) : "";

  if (sys && tech && normKey(sys) !== normKey(tech)) {
    return `${sys} - ${tech}`;
  }
  if (sys) return sys;
  if (tech) return tech;

  const id = typeof identityFocus === "string" ? identityFocus.trim() : "";
  return id ? id : "Pick one position";
}

/**
 * SUMMARY PIPELINE CONTRACT (DO NOT BREAK)
 *
 * 1. System selection happens ONLY in selectFocusSystem
 * 2. Progression logic happens ONLY in computeProgression
 * 3. Identity tone happens ONLY in formatActionByIdentity
 *
 * buildSummaryViewModel is a composition layer ONLY.
 * It must NOT:
 * - contain progression logic
 * - contain alignment logic
 * - contain action wording logic
 *
 * Any changes to behavior must happen in the dedicated modules.
 */

export function buildSummaryViewModel(
  input: BuildSummaryViewModelInput,
): SummaryViewModel {
  const insights: SummaryInsights = deriveSummaryInsights({
    signals: input.signals,
    identityScore: input.identityScore,
    phase: input.phase,
    identityFocus: input.identityFocus,
    sessions: input.sessions,
    coachSignals: input.coachSignals ?? null,
  });

  deriveSummaryExplanation({
    identityScore: input.identityScore,
    phase: input.phase,
    beltRank: input.beltRank,
    declaredSkills: input.declaredSkills,
    sessionCount: input.sessionCount,
    competitionCount: input.competitionCount,
    signals: input.signals,
    trend: insights.trend,
  });

  const snap = extractSignalSnapshot(input.signals);
  const identityState = resolveIdentityState({
    sessionCount: input.sessionCount,
    competitionCount: input.competitionCount,
    hasData: snap.hasData,
  });
  const alignment = computeCoachAlignment({
    coachWeekly: input.coachWeekly ?? null,
    signals: input.signals,
    exposurePending: input.exposurePending ?? null,
  });
  const system = selectFocusSystem({
    coachSystem: input.coachWeekly?.headline,
    signalSystem: snap.topSystem,
    identityFocus: input.identityFocus,
  });
  const progression = computeProgression({
    coachSystem: system,
    topSystem: null,
    lastAction: input.lastAction ?? null,
    alignmentStatus: alignment.status,
  });

  /**
   * HERO OUTPUT CONTRACT (LOCKED)
   *
   * PROGRESS:
   * - Must be a short headline
   * - Must NOT repeat WHY
   *
   * WHY:
   * - Must explain the gap or validation
   * - May include counts (sessions, competitions)
   * - Must NOT repeat PROGRESS wording
   *
   * DO NOT:
   * - add new branching logic here
   * - move progression logic into this file
   * - add signal computation here
   *
   * This file is translation only.
   */

  const progress = (() => {
    switch (alignment.status) {
      case "no_focus":
        return "No coach focus set yet";

      case "no_data":
        return "No training yet — start building reps";

      case "misaligned":
        return input.sessionCount
          ? `${system ?? "This position"} is not being trained`
          : "Training does not match your focus";

      case "aligned":
        return input.sessionCount
          ? `${system ?? "This position"} is being trained (${input.sessionCount} sessions)`
          : `${system ?? "This position"} is being trained`;

      case "validated":
        return input.competitionCount
          ? `${system ?? "This position"} is working in competition`
          : `${system ?? "This position"} is working in live rounds`;

      default:
        return "";
    }
  })();

  const why = (() => {
    switch (alignment.status) {
      case "no_focus":
        return "No coach focus has been set.";

      case "no_data":
        return "There are no sessions logged for this focus yet.";

      case "misaligned":
        return input.sessionCount
          ? `Your last ${input.sessionCount} sessions are not focused on ${system ?? "this position"}`
          : `Your recent sessions are not focused on ${system ?? "this position"}`;

      case "aligned":
        return input.sessionCount
          ? `You've trained this ${input.sessionCount} times, but it hasn't shown up in live rounds yet`
          : `You are training this, but it hasn't shown up in live rounds yet`;

      case "validated":
        return input.competitionCount
          ? `You are applying this successfully in competition`
          : `You are applying this successfully in live rounds`;

      default:
        return "";
    }
  })();

  const action = formatActionByIdentity(
    progression.action,
    identityState,
  );

  return {
    focus: buildFocusLine(
      snap,
      input.identityFocus,
      input.coachWeekly?.headline?.trim() || null,
    ),
    action,
    progress,
    why,
    stepKey: progression.stepKey,
  };
}
