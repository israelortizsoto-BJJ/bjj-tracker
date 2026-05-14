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
    systemKey?: string | null;
    body?: string;
  } | null;
  exposurePending?: any | null;
  lastAction?: string | null;
  /** __TEMP__ Operator Mode: labels [SUMMARY_FLOW_TRACE] for parent vs coach. */
  devSummaryFlowTraceRole?: "parent" | "coach" | "unknown";
  /** __DEV__ Operator Mode: athlete id for [SUMMARY_PROGRESS_INPUT] only. */
  devOperatorAthleteId?: string | null;
  /** __DEV__ SummaryHeroCard → SummaryV2Card only: final VM derivation trace. */
  devFinalHeroVmTrace?: { athleteId: string | null } | null;
};

type SignalSnapshot = {
  hasData: boolean;
  topSystem: string | null;
  topTechnique: string | null;
};

/** Exported for dual buildSummaryViewModel audit logs (screen vs hero). */
export function extractSignalSnapshot(raw: unknown): SignalSnapshot {
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

function displaySystem(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? formatDisplay(t) : null;
}

function devVmTraceField<T>(
  sourceOwner: string,
  raw: T,
  normalized?: unknown,
): { sourceOwner: string; raw: T; normalized: unknown } {
  return {
    sourceOwner,
    raw,
    normalized: normalized !== undefined ? normalized : (raw as unknown) ?? null,
  };
}

function coachWeeklyHasMission(
  cw: BuildSummaryViewModelInput["coachWeekly"],
): cw is NonNullable<BuildSummaryViewModelInput["coachWeekly"]> {
  if (!cw) return false;
  const key = cw.systemKey?.trim();
  const head = cw.headline?.trim();
  return Boolean(key || head);
}

/** Alignment / progression target when a weekly coach mission exists (key beats headline for taxonomy). */
function resolvedMissionSystemForWeekly(
  cw: NonNullable<BuildSummaryViewModelInput["coachWeekly"]>,
  coachSystemKey: string | null,
): string | null {
  return coachSystemKey ?? cw.headline?.trim() ?? null;
}

function buildFocusLine(
  snap: SignalSnapshot,
  identityFocus?: string | null,
  coachWeekly?: BuildSummaryViewModelInput["coachWeekly"],
): string {
  if (coachWeekly && coachWeeklyHasMission(coachWeekly)) {
    const headline = coachWeekly.headline?.trim();
    if (headline) return headline;
    const key = coachWeekly.systemKey?.trim();
    if (key) return displaySystem(key) ?? key;
  }

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
 * 1. When `coachWeekly` carries a mission (headline or systemKey), that mission owns
 *    alignment target, progression, progress/why labels (via systemLabel), and focus headline.
 *    Signals only prove alignment in computeCoachAlignment.
 * 2. Otherwise system selection happens ONLY in selectFocusSystem (coach key, identity, signals).
 * 3. Progression logic happens ONLY in computeProgression
 * 4. Identity tone happens ONLY in formatActionByIdentity
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
  if (__DEV__) {
    console.log("[SYSTEMKEY TRACE SUMMARY]", {
      traceStage: "11_buildSummaryViewModel_input_coachWeekly",
      headline: input.coachWeekly?.headline?.slice(0, 120) ?? null,
      systemKey: input.coachWeekly?.systemKey ?? null,
      athleteId: null,
      weekStartYMD: null,
      keyExistsOnObject:
        input.coachWeekly != null &&
        Object.prototype.hasOwnProperty.call(input.coachWeekly, "systemKey"),
      source: "buildSummaryViewModel_entry",
    });
  }
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
  const coachSystemKey = input.coachWeekly?.systemKey?.trim() || null;
  const weeklyMissionDoc =
    input.coachWeekly && coachWeeklyHasMission(input.coachWeekly)
      ? input.coachWeekly
      : null;
  const system = weeklyMissionDoc
    ? resolvedMissionSystemForWeekly(weeklyMissionDoc, coachSystemKey)
    : selectFocusSystem({
        coachSystem: coachSystemKey,
        signalSystem: snap.topSystem,
        identityFocus: input.identityFocus,
      });
  const identityState = resolveIdentityState({
    sessionCount: input.sessionCount,
    competitionCount: input.competitionCount,
    hasData: snap.hasData,
  });
  const alignment = computeCoachAlignment({
    signals: input.signals,
    exposurePending: input.exposurePending ?? null,
    resolvedFocusSystem: system,
  });
  const systemLabel = displaySystem(system);
  const flow = input.devSummaryFlowTraceRole ?? "unknown";

  if (__DEV__) {
    console.log("[SUMMARY_FLOW_TRACE] 4_progression_computation_input", {
      flow,
      sessionCountVm: input.sessionCount ?? 0,
      resolvedFocusSystem: system,
      coachWeeklyHeadline: input.coachWeekly?.headline?.slice(0, 120) ?? null,
      coachWeeklySystemKey: input.coachWeekly?.systemKey ?? null,
      alignmentStatus: alignment.status,
      lastAction: input.lastAction ?? null,
      signalTopSystem: snap.topSystem,
      signalHasData: snap.hasData,
    });
  }

  const progression = computeProgression({
    coachSystem: system,
    topSystem: null,
    lastAction: input.lastAction ?? null,
    alignmentStatus: alignment.status,
  });

  if (__DEV__) {
    const athleteIdForLog =
      (typeof input.devOperatorAthleteId === "string" && input.devOperatorAthleteId.trim()
        ? input.devOperatorAthleteId.trim()
        : null) ??
      input.devFinalHeroVmTrace?.athleteId?.trim() ??
      null;
    console.log("[SUMMARY_PROGRESS_INPUT]", {
      athleteId: athleteIdForLog,
      sessionCount: input.sessionCount ?? 0,
      competitionCount: input.competitionCount ?? 0,
      topSystem: snap.topSystem,
      coachSystemKey,
      progressionStage: progression.stepKey,
      identityState,
    });
  }

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
        return "No coach system set yet";

      case "directed_no_proof":
        return `${systemLabel ?? "Coach direction"} is set — log proof next`;

      case "misaligned":
        return input.sessionCount
          ? `${systemLabel ?? "This position"} is not being trained`
          : "Training does not match your focus";

      case "aligned":
        return input.sessionCount
          ? `${systemLabel ?? "This position"} is being trained (${input.sessionCount} sessions)`
          : `${systemLabel ?? "This position"} is being trained`;

      case "validated":
        return input.competitionCount
          ? `${systemLabel ?? "This position"} is working in competition`
          : `${systemLabel ?? "This position"} is working in live rounds`;

      default:
        return "";
    }
  })();

  const why = (() => {
    switch (alignment.status) {
      case "no_focus":
        return "This weekly note does not include a system classification yet.";

      case "directed_no_proof":
        return "Coach direction is ready, but this athlete has not logged training proof for it yet.";

      case "misaligned":
        return input.sessionCount
          ? `Your last ${input.sessionCount} sessions are not focused on ${systemLabel ?? "this position"}`
          : `Your recent sessions are not focused on ${systemLabel ?? "this position"}`;

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

  const focus = buildFocusLine(snap, input.identityFocus, input.coachWeekly ?? null);

  if (__DEV__) {
    console.log("[SUMMARY WEEKLY TRACE] buildSummaryViewModel.focusPipeline", {
      path: "buildSummaryViewModel → buildFocusLine",
      focus,
      weeklyMissionLocksCoachTruth: weeklyMissionDoc != null,
      focusSource: weeklyMissionDoc
        ? input.coachWeekly?.headline?.trim()
          ? "coach_weekly_headline"
          : coachSystemKey
            ? "coach_weekly_systemKey_display"
            : "coach_weekly_unknown"
        : "signals_identity_selectFocusSystem_fallback",
      coachSystemKey: coachSystemKey ?? null,
      coachWeeklyHeadline: input.coachWeekly?.headline?.slice(0, 120) ?? null,
      resolvedAlignmentSystem: system,
      signalTopSystem: snap.topSystem,
      signalTopTechnique: snap.topTechnique,
      identityFocusSnippet:
        typeof input.identityFocus === "string"
          ? input.identityFocus.slice(0, 80)
          : null,
    });
  }

  if (__DEV__ && input.devFinalHeroVmTrace) {
    const sig = input.signals as {
      patterns?: { topSystem?: string | null };
      systems?: { topSystem?: string | null };
    } | null;
    const rawPatternsTop = sig?.patterns?.topSystem ?? null;
    const rawSystemsTop = sig?.systems?.topSystem ?? null;
    const progStepKey = progression.stepKey;
    const progSysNorm =
      typeof progStepKey === "string" && !progStepKey.startsWith("none:")
        ? progStepKey.split(":")[0] ?? null
        : null;

    console.log("[SUMMARY FINAL HERO VM TRACE] buildSummaryViewModel", {
      path: "SummaryHeroCard → buildSummaryViewModel (card VM only)",
      athleteId: devVmTraceField(
        "SummaryHeroCard.devFinalHeroVmTrace",
        input.devFinalHeroVmTrace.athleteId,
        input.devFinalHeroVmTrace.athleteId?.trim() || null,
      ),
      coachWeeklySystemKey: devVmTraceField(
        "input.coachWeekly.systemKey",
        input.coachWeekly?.systemKey ?? null,
        input.coachWeekly?.systemKey?.trim() || null,
      ),
      coachWeeklyHeadline: devVmTraceField(
        "input.coachWeekly.headline",
        input.coachWeekly?.headline ?? null,
        input.coachWeekly?.headline?.trim() || null,
      ),
      selectedSystemKey: devVmTraceField(
        weeklyMissionDoc
          ? "coachWeeklyMission → systemKey ?? headline (signals excluded)"
          : "selectFocusSystem(coachSystemKey, snap.topSystem, identityFocus)",
        system,
        system?.trim() || null,
      ),
      signalsPatternsTopSystem: devVmTraceField(
        "input.signals.patterns.topSystem (hero hybridConfidence)",
        rawPatternsTop,
        typeof rawPatternsTop === "string" ? rawPatternsTop.trim() || null : null,
      ),
      signalsSystemsTopSystem: devVmTraceField(
        "input.signals.systems.topSystem (hero hybridConfidence)",
        rawSystemsTop,
        typeof rawSystemsTop === "string" ? rawSystemsTop.trim() || null : null,
      ),
      identityFocus: devVmTraceField(
        "BuildSummaryViewModelInput.identityFocus",
        input.identityFocus ?? null,
        typeof input.identityFocus === "string" ? input.identityFocus.trim() || null : null,
      ),
      hybridConfidencePatternsTopSystem: devVmTraceField(
        "same object as input.signals — patterns.topSystem",
        rawPatternsTop,
        typeof rawPatternsTop === "string" ? rawPatternsTop.trim() || null : null,
      ),
      hybridConfidenceSystemsTopSystem: devVmTraceField(
        "same object as input.signals — systems.topSystem",
        rawSystemsTop,
        typeof rawSystemsTop === "string" ? rawSystemsTop.trim() || null : null,
      ),
      progressionSystemKey: devVmTraceField(
        "computeProgression → stepKey system prefix (normalized internal)",
        progStepKey,
        progSysNorm,
      ),
      alignmentStatus: devVmTraceField(
        "computeCoachAlignment(resolvedFocusSystem=selectedSystemKey)",
        alignment.status,
        alignment.status,
      ),
      finalFocus: devVmTraceField(
        "buildSummaryViewModel output.focus",
        focus,
        focus.trim(),
      ),
      finalProgress: devVmTraceField(
        "buildSummaryViewModel output.progress",
        progress,
        progress.trim(),
      ),
      finalWhy: devVmTraceField(
        "buildSummaryViewModel output.why",
        why,
        why.trim(),
      ),
    });
  }

  if (__DEV__) {
    console.log("[SUMMARY_FLOW_TRACE] 5_final_summary_vm_output", {
      flow,
      sessionCountVm: input.sessionCount ?? 0,
      focus,
      action,
      progress,
      why,
      stepKey: progression.stepKey ?? null,
      alignmentStatus: alignment.status,
    });
  }

  return {
    focus,
    action,
    progress,
    why,
    stepKey: progression.stepKey,
  };
}
