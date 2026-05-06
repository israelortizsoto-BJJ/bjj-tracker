import { toDateKey } from "../../_domain/dateKey";
import {
  trainingSkillBucketDisplayLabel,
  type TrainingSkillBucket,
} from "../../ai-coach/skillBucketText";
import { getPlacementLabel } from "../../features/competition/placementLabel";
import { inferPrimaryTrainingSkillBucketForCompetitionEntry } from "./competitionMatchBucketAggregate";
import type { CompetitionEntry } from "./computeSignals";

export type CompetitionBucketHistoryRow = {
  date: string;
  bucket: TrainingSkillBucket;
  /** Placement label (“1st”, “2nd”, …) from stored results. */
  result: string;
};

export type BucketOutcomeTrend = "improving" | "unchanged" | "declining";

const BUCKET_TREND_MIN = 3;

type KnownCompetitionStoredTier =
  | "gold"
  | "silver"
  | "bronze"
  | "participated"
  | "dnf"
  | "other";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseKnownCompetitionStoredTier(
  competition: Pick<CompetitionEntry, "result">,
): KnownCompetitionStoredTier | null {
  const raw = cleanText(competition.result).toLowerCase();
  if (
    raw === "gold" ||
    raw === "silver" ||
    raw === "bronze" ||
    raw === "participated" ||
    raw === "dnf" ||
    raw === "other"
  ) {
    return raw;
  }
  return null;
}

function ordinalForStoredTier(tier: KnownCompetitionStoredTier): number {
  switch (tier) {
    case "dnf":
      return 0;
    case "other":
      return 1;
    case "participated":
      return 2;
    case "bronze":
      return 3;
    case "silver":
      return 4;
    case "gold":
      return 5;
    default:
      return -1;
  }
}

/** Same placement mapping as signals UI (`computeSignals`). */
function competitionResultDisplayFromStored(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower === "dnf") return "DNF";
  if (lower === "other") return "Other";
  if (
    lower === "gold" ||
    lower === "silver" ||
    lower === "bronze" ||
    lower === "participated"
  ) {
    return getPlacementLabel(lower as "gold" | "silver" | "bronze" | "participated");
  }
  return cleaned;
}

/** Strict monotonic or flat run only — `null` when inconsistent/thin data. */
function deriveBucketOutcomeTrendFromOrdinalRun(
  ordinals: readonly number[],
): BucketOutcomeTrend | null {
  if (ordinals.length < BUCKET_TREND_MIN) return null;
  if (ordinals.some((o) => !Number.isFinite(o) || o < 0)) return null;

  const plateau = ordinals.every((o) => o === ordinals[0]);

  let improving = true;
  let declining = true;
  for (let i = 0; i < ordinals.length - 1; i++) {
    if (ordinals[i + 1] <= ordinals[i]) improving = false;
    if (ordinals[i + 1] >= ordinals[i]) declining = false;
  }

  if (plateau) return "unchanged";
  if (improving) return "improving";
  if (declining) return "declining";
  return null;
}

function sortLabeledCompetitionsChronological(
  competitions: readonly CompetitionEntry[],
): { entry: CompetitionEntry; date: string; tier: KnownCompetitionStoredTier; resultLabel: string }[] {
  const rows = competitions
    .map((entry) => {
      const date = toDateKey(entry.eventDate);
      const tier = date ? parseKnownCompetitionStoredTier(entry) : null;
      const label = tier ? competitionResultDisplayFromStored(entry.result) : null;
      return date && tier && label
        ? { entry, date, tier, resultLabel: label }
        : null;
    })
    .filter(Boolean) as {
    entry: CompetitionEntry;
    date: string;
    tier: KnownCompetitionStoredTier;
    resultLabel: string;
  }[];

  return rows.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return cleanText(a.entry.createdAt ?? "").localeCompare(cleanText(b.entry.createdAt ?? ""));
  });
}

/**
 * Builds per-event bucket tagging + chronological bucket history + per-bucket outcome trends (≥3 labeled
 * datapoints **for that bucket** with a stable improve/flat/decline pattern).
 */
export function deriveCompetitionBucketHistorySignals(competitions: readonly CompetitionEntry[]): {
  bucketHistory: CompetitionBucketHistoryRow[];
  bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>;
} {
  const chrono = sortLabeledCompetitionsChronological(competitions);

  const bucketHistory: CompetitionBucketHistoryRow[] = [];
  const byBucketOrdinalLists = new Map<TrainingSkillBucket, number[]>();

  for (const row of chrono) {
    const bucket = inferPrimaryTrainingSkillBucketForCompetitionEntry(row.entry);
    if (!bucket) continue;
    bucketHistory.push({
      date: row.date,
      bucket,
      result: row.resultLabel,
    });
    const ordinal = ordinalForStoredTier(row.tier);
    if (ordinal < 0) continue;
    const list = byBucketOrdinalLists.get(bucket) ?? [];
    list.push(ordinal);
    byBucketOrdinalLists.set(bucket, list);
  }

  const bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>> = {};
  for (const [bucket, ordinals] of byBucketOrdinalLists.entries()) {
    const trend = deriveBucketOutcomeTrendFromOrdinalRun(ordinals);
    if (trend) bucketOutcomeTrends[bucket] = trend;
  }

  return { bucketHistory, bucketOutcomeTrends };
}

export function formatBucketTrendForSnapshot(trend: BucketOutcomeTrend): string {
  switch (trend) {
    case "improving":
      return "improving";
    case "unchanged":
      return "steady";
    case "declining":
      return "declining";
  }
}

/** Summary line — only meaningful when upstream passes a principal bucket tied to structured focus hints. */
export function resolvePrincipalBucketEvidenceLine(
  principalBucket: TrainingSkillBucket | null | undefined,
  trends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>,
): string | null {
  if (!principalBucket) return null;
  const trend = trends[principalBucket];
  if (!trend) return null;
  const label = trainingSkillBucketDisplayLabel(principalBucket);
  return `${label}: ${formatBucketTrendForSnapshot(trend)}`;
}

export type AthleteBucketMomentum = {
  focusBucket: TrainingSkillBucket | null;
  bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>;
};

/**
 * Rosters ≥2 qualifying athletes bucket → trend matches (optional Team Focus captions).
 */
export function summarizeTeamBucketMomentum(rows: AthleteBucketMomentum[]): {
  mostImproved: { bucket: TrainingSkillBucket; count: number } | null;
  needsAttention: { bucket: TrainingSkillBucket; count: number } | null;
} {
  const improvingCounts = new Map<TrainingSkillBucket, number>();
  const decliningCounts = new Map<TrainingSkillBucket, number>();

  for (const r of rows) {
    if (!r.focusBucket) continue;
    const t = r.bucketOutcomeTrends[r.focusBucket];
    if (t === "improving") improvingCounts.set(r.focusBucket, (improvingCounts.get(r.focusBucket) ?? 0) + 1);
    if (t === "declining") decliningCounts.set(r.focusBucket, (decliningCounts.get(r.focusBucket) ?? 0) + 1);
  }

  const minTeam = 2;
  let mostImproved: { bucket: TrainingSkillBucket; count: number } | null = null;
  for (const [bucket, count] of improvingCounts.entries()) {
    if (count < minTeam) continue;
    if (!mostImproved || count > mostImproved.count) mostImproved = { bucket, count };
  }

  let needsAttention: { bucket: TrainingSkillBucket; count: number } | null = null;
  for (const [bucket, count] of decliningCounts.entries()) {
    if (count < minTeam) continue;
    if (!needsAttention || count > needsAttention.count) needsAttention = { bucket, count };
  }

  return { mostImproved, needsAttention };
}
