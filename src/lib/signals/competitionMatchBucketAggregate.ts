import { inferSkillBucketsFromText, type TrainingSkillBucket } from "../../ai-coach/skillBucketText";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";

/** Shape needed for match-note bucket tagging (no dependency on `computeSignals`). */
export type MatchSignalsCompetitionRow = Partial<KidCompetitionEntry> & {
  matches?: readonly Partial<CompetitionDetailMatchSnapshot>[] | null;
};

export function aggregateCompetitionMatchSignals(entries: readonly MatchSignalsCompetitionRow[]): {
  lossBuckets: Map<TrainingSkillBucket, number>;
  winBuckets: Map<TrainingSkillBucket, number>;
  lossMatchesWithOutcome: number;
  lossViaPoints: number;
  lossViaSubmission: number;
  winMatchesWithSubmission: number;
  winMatches: number;
} {
  let lossMatchesWithOutcome = 0;
  let lossViaPoints = 0;
  let lossViaSubmission = 0;

  const lossBuckets = new Map<TrainingSkillBucket, number>();
  const winBuckets = new Map<TrainingSkillBucket, number>();

  let winMatchesWithSubmission = 0;
  let winMatches = 0;

  for (const entry of entries) {
    const matchList = Array.isArray(entry.matches) ? entry.matches : [];
    const hadLossOnCard = matchList.some((m) => m.matchResult === "loss");

    for (const m of matchList) {
      const note = typeof m.coachNote === "string" ? m.coachNote.trim() : "";
      const mr = m.matchResult;

      if (mr === "loss") {
        lossMatchesWithOutcome += 1;
        if (m.outcome === "Points") lossViaPoints += 1;
        if (m.outcome === "Submission") lossViaSubmission += 1;

        const fromNote = inferSkillBucketsFromText(note);
        const seenLocal = new Set<TrainingSkillBucket>();
        for (const b of fromNote) {
          if (!seenLocal.has(b)) {
            seenLocal.add(b);
            lossBuckets.set(b, (lossBuckets.get(b) ?? 0) + 1);
          }
        }
      } else if (mr === "win") {
        winMatches += 1;
        if (m.outcome === "Submission") {
          winMatchesWithSubmission += 1;
          winBuckets.set("submissions", (winBuckets.get("submissions") ?? 0) + 1);
        }

        const fromNote = inferSkillBucketsFromText(note);
        const seenLocal = new Set<TrainingSkillBucket>();
        for (const b of fromNote) {
          if (!seenLocal.has(b)) {
            seenLocal.add(b);
            winBuckets.set(b, (winBuckets.get(b) ?? 0) + 1);
          }
        }
      }
    }

    const entryCoach = typeof entry.coachNotes === "string" ? entry.coachNotes.trim() : "";
    if (entryCoach) {
      const seenEvent = new Set<TrainingSkillBucket>();
      const fromEntry = inferSkillBucketsFromText(entryCoach);
      for (const b of fromEntry) {
        if (!seenEvent.has(b)) {
          seenEvent.add(b);
          if (hadLossOnCard) lossBuckets.set(b, (lossBuckets.get(b) ?? 0) + 1);
          else winBuckets.set(b, (winBuckets.get(b) ?? 0) + 1);
        }
      }
    }
  }

  return {
    lossBuckets,
    winBuckets,
    lossMatchesWithOutcome,
    lossViaPoints,
    lossViaSubmission,
    winMatchesWithSubmission,
    winMatches,
  };
}

export function mergeStructuralLossSignal(
  lossBuckets: Map<TrainingSkillBucket, number>,
  lossMatchesWithOutcome: number,
  lossViaPoints: number,
): void {
  if (lossMatchesWithOutcome < 3) return;
  const ratio = lossViaPoints / lossMatchesWithOutcome;
  if (ratio >= 0.55) {
    lossBuckets.set("positioning", (lossBuckets.get("positioning") ?? 0) + 2);
  }
}

export function rankedLossBuckets(lossBuckets: Map<TrainingSkillBucket, number>): {
  bucket: TrainingSkillBucket;
  score: number;
}[] {
  return [...lossBuckets.entries()]
    .map(([bucket, score]) => ({ bucket, score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.bucket.localeCompare(b.bucket));
}

/**
 * Matches loss-led / structural heuristics used in `deriveCompetitionTrainingSkillFocus`,
 * scoped to a single event (no session blob).
 */
export function inferPrimaryTrainingSkillBucketForCompetitionEntry(
  entry: MatchSignalsCompetitionRow,
): TrainingSkillBucket | null {
  const agg = aggregateCompetitionMatchSignals([entry]);
  const lossBuckets = new Map(agg.lossBuckets);
  mergeStructuralLossSignal(lossBuckets, agg.lossMatchesWithOutcome, agg.lossViaPoints);
  const ranked = rankedLossBuckets(lossBuckets);
  if (ranked[0]?.score >= 2) {
    return ranked[0]!.bucket;
  }

  if (
    agg.lossMatchesWithOutcome >= 3 &&
    agg.lossViaSubmission / agg.lossMatchesWithOutcome >= 0.55
  ) {
    return "defense";
  }

  const winSubs = [...agg.winBuckets.entries()].find(([b]) => b === "submissions");
  const winSubScore = winSubs?.[1] ?? 0;
  if (
    agg.lossMatchesWithOutcome === 0 &&
    agg.winMatches >= 3 &&
    agg.winMatchesWithSubmission / agg.winMatches >= 0.55 &&
    winSubScore >= 2
  ) {
    return "submissions";
  }

  return null;
}
