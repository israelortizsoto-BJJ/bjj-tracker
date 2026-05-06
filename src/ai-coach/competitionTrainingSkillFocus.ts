import {
  computeMultiEventCompetitionMetrics,
  type CompetitionEntry,
  type CompetitionPlacementTrend,
} from "../lib/signals/computeSignals";
import {
  aggregateCompetitionMatchSignals,
  mergeStructuralLossSignal,
  rankedLossBuckets,
} from "../lib/signals/competitionMatchBucketAggregate";
import {
  inferSkillBucketsFromText,
  SKILL_BUCKET_TOPIC_PHRASES,
  trainingSkillPhraseTitleCase,
  type TrainingSkillBucket,
} from "./skillBucketText";
import type { Session } from "../types";

export type { TrainingSkillBucket } from "./skillBucketText";
export {
  inferSkillBucketsFromText,
  trainingSkillBucketDisplayLabel,
  trainingSkillBucketTopicPhrase,
} from "./skillBucketText";

export type CompetitionTrainingSkillFocus = {
  /** Short suggestions for cues (1–2 items). */
  focusFragments: string[];
  /** Single label for optional summary line (notes/structured match patterns only—not generic trend prose). */
  summaryLabel: string | null;
  highConfidence: boolean;
  eligibleForSummaryLine: boolean;
  /** From recent labeled events when derivation ran (thin-data → null inside signals). */
  placementTrend?: CompetitionPlacementTrend | null;
};

function competitionSkillFocusEntries(rows: readonly CompetitionEntry[]): CompetitionEntry[] {
  return [...rows];
}

function sessionTextBlob(sessions: readonly Session[], cap: number): string {
  const slice = sessions.slice(0, cap);
  const parts: string[] = [];
  for (const s of slice) {
    parts.push(s.system, s.technique, s.notes, s.drill ?? "");
    parts.push(s.position ?? "", s.grips ?? "", s.finish ?? "");
    parts.push(s.customTechnique ?? "");
    if (Array.isArray(s.techniques)) {
      for (const t of s.techniques) {
        parts.push(
          t.position ?? "",
          t.grips ?? "",
          t.finish ?? "",
          t.technique ?? "",
          t.customTechnique ?? "",
        );
      }
    }
  }
  return parts.filter((p) => typeof p === "string" && p.trim()).join(" ");
}

function mergeSessionHints(lossBuckets: Map<TrainingSkillBucket, number>, sessions: readonly Session[]) {
  const blob = sessionTextBlob(sessions, 40);
  if (!blob.trim()) return;
  const fromSessions = inferSkillBucketsFromText(blob);
  const seen = new Set<TrainingSkillBucket>();
  for (const b of fromSessions) {
    if (!seen.has(b)) {
      seen.add(b);
      lossBuckets.set(b, (lossBuckets.get(b) ?? 0) + 0.5);
    }
  }
}

function buildFragmentsFromLosses(
  ranked: { bucket: TrainingSkillBucket; score: number }[],
  placementTrend: CompetitionPlacementTrend | null,
  silverStreak: boolean,
): { fragments: string[]; summaryLabel: string | null } | null {
  if (ranked.length === 0) return null;

  const [first, second] = ranked;
  if (first.score < 2) return null;

  const fragments: string[] = [SKILL_BUCKET_TOPIC_PHRASES[first.bucket]];
  if (
    second &&
    second.bucket !== first.bucket &&
    second.score >= 2 &&
    fragments.length < 2
  ) {
    fragments.push(SKILL_BUCKET_TOPIC_PHRASES[second.bucket]);
  }

  if (silverStreak && first.bucket === "guard_retention") {
    return {
      fragments: [
        `${SKILL_BUCKET_TOPIC_PHRASES.guard_retention} to break through repeat 2nd-place finishes`,
      ],
      summaryLabel: trainingSkillPhraseTitleCase(SKILL_BUCKET_TOPIC_PHRASES.guard_retention),
    };
  }

  if (placementTrend === "plateau" && first.bucket === "positioning") {
    return {
      fragments: [
        `${SKILL_BUCKET_TOPIC_PHRASES.positioning}—results are hovering at one tier; sharpen scoring moments`,
      ],
      summaryLabel: trainingSkillPhraseTitleCase(SKILL_BUCKET_TOPIC_PHRASES.positioning),
    };
  }

  return {
    fragments: fragments.slice(0, 2),
    summaryLabel: trainingSkillPhraseTitleCase(SKILL_BUCKET_TOPIC_PHRASES[first.bucket]),
  };
}

/**
 * Deterministic skill focus from logged match notes + session text + sparse structural stats.
 * Returns null when patterns are thin or ambiguous.
 */
export function deriveCompetitionTrainingSkillFocus(input: {
  competitionsWithMatches: readonly CompetitionEntry[];
  sessions?: readonly Session[];
  maxEvents?: number;
}): CompetitionTrainingSkillFocus | null {
  const maxEv = typeof input.maxEvents === "number" ? input.maxEvents : 12;
  const sorted = [...input.competitionsWithMatches].sort((a, b) => {
    const d = String(b.eventDate ?? "").localeCompare(String(a.eventDate ?? ""));
    if (d !== 0) return d;
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });

  const window = sorted.slice(0, maxEv);
  if (window.length === 0) return null;

  const metrics = computeMultiEventCompetitionMetrics(competitionSkillFocusEntries(window));
  const placementTrend = metrics.placementTrend;

  const {
    lossBuckets,
    winBuckets,
    lossMatchesWithOutcome,
    lossViaPoints,
    lossViaSubmission,
    winMatchesWithSubmission,
    winMatches,
  } = aggregateCompetitionMatchSignals(window);

  mergeStructuralLossSignal(lossBuckets, lossMatchesWithOutcome, lossViaPoints);
  if (input.sessions?.length) {
    mergeSessionHints(lossBuckets, input.sessions);
  }

  const recentSilverOnly =
    metrics.recentResults.length >= 2 &&
    metrics.recentResults.every((r) => r.resultLabel === "2nd");
  const silverStreak =
    placementTrend === "plateau" && metrics.mostCommonResult === "2nd" && recentSilverOnly;

  const ranked = rankedLossBuckets(lossBuckets);
  const fromLosses = buildFragmentsFromLosses(ranked, placementTrend, silverStreak);
  if (fromLosses) {
    const topScore = ranked[0]?.score ?? 0;
    if (topScore >= 2) {
      return {
        focusFragments: fromLosses.fragments,
        summaryLabel: fromLosses.summaryLabel,
        highConfidence: true,
        eligibleForSummaryLine: true,
        placementTrend,
      };
    }
  }

  const winSubs = [...winBuckets.entries()].find(([b]) => b === "submissions");
  const winSubScore = winSubs?.[1] ?? 0;
  if (
    lossMatchesWithOutcome === 0 &&
    winMatches >= 3 &&
    winMatchesWithSubmission / winMatches >= 0.55 &&
    winSubScore >= 2
  ) {
    return {
      focusFragments: [
        "submission finishing chains—you are already forcing taps; tighten entries and resets between attempts",
      ],
      summaryLabel: "Submission chains",
      highConfidence: true,
      eligibleForSummaryLine: true,
      placementTrend,
    };
  }

  if (
    lossMatchesWithOutcome >= 3 &&
    lossViaSubmission / lossMatchesWithOutcome >= 0.55
  ) {
    return {
      focusFragments: [SKILL_BUCKET_TOPIC_PHRASES.defense],
      summaryLabel: trainingSkillPhraseTitleCase(SKILL_BUCKET_TOPIC_PHRASES.defense),
      highConfidence: true,
      eligibleForSummaryLine: true,
      placementTrend,
    };
  }

  return null;
}

/** Short label for UI / weekly augmentation when competition-derived focus is high-confidence. */
export function recommendedFocusAreaFromTrainingSkillFocus(
  trainingSkillFocus: CompetitionTrainingSkillFocus | null | undefined,
): string | undefined {
  if (!trainingSkillFocus) return undefined;
  if (!trainingSkillFocus.highConfidence || !trainingSkillFocus.eligibleForSummaryLine) return undefined;
  const label = trainingSkillFocus.summaryLabel?.trim();
  if (label) return label;
  const first = trainingSkillFocus.focusFragments.find((f) => f.trim());
  return first ? first.trim() : undefined;
}

/** Buckets aggregated focus for coach roster summaries (highConfidence only upstream). */
export function principalTrainingSkillBucketFromDerivedFocus(
  tf: CompetitionTrainingSkillFocus | null | undefined,
): TrainingSkillBucket | null {
  if (!tf?.highConfidence) return null;

  const rec = recommendedFocusAreaFromTrainingSkillFocus(tf)?.trim();
  const joined = [
    ...(rec ? [rec] : []),
    ...tf.focusFragments.map((f) => f.trim()).filter(Boolean),
  ].join(" ");

  let hits = joined.trim().length ? inferSkillBucketsFromText(joined) : [];
  if (hits.length === 0 && rec) hits = inferSkillBucketsFromText(rec);
  if (hits.length === 0) {
    const lower = String(rec ?? tf.summaryLabel ?? "").toLowerCase();
    if (lower.includes("submission")) return "submissions";
    if (lower.includes("defense") || lower.includes("escape")) return "defense";
    if (lower.includes("position")) return "positioning";
    if (lower.includes("guard") || lower.includes("retention")) return "guard_retention";
    if (lower.includes("sweep")) return "sweeps";
    return null;
  }
  return hits[0] ?? null;
}

export function principalTrainingSkillBucketFromCoachFocusText(text: string): TrainingSkillBucket | null {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return null;
  const hits = inferSkillBucketsFromText(t);
  if (hits.length > 0) return hits[0] ?? null;
  const lower = t.toLowerCase();
  if (lower.includes("submission")) return "submissions";
  if (lower.includes("defense") || lower.includes("escape")) return "defense";
  if (lower.includes("position")) return "positioning";
  if (lower.includes("guard") || lower.includes("retention")) return "guard_retention";
  if (lower.includes("sweep")) return "sweeps";
  return null;
}
