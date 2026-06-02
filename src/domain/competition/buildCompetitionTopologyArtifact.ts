import { normalizeStoredSubmissionType } from "../../features/competition/submissionTypes";
import { logCompetitionTopologyTrace } from "../../dev/competitionTopologyTrace";
import {
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
  type CompetitionDetailMatchSnapshot,
  type KidCompetitionEntryWithMatchDetail,
} from "../../storage/competitionStore";
import type {
  SyncedCompetitionMatchTopology,
  SyncedCompetitionTopology,
  SyncedCompetitionTopologyArtifact,
  SyncedCompetitionTopologyFinishType,
} from "../../types/coachWeeklySync";

function parseMatchDurationSeconds(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const parts = text.split(":");
  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
  }
  if (parts.length !== 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  return Math.round(minutes * 60 + seconds);
}

function normalizeFinishType(
  raw: CompetitionDetailMatchSnapshot["outcome"],
): SyncedCompetitionTopologyFinishType {
  switch (raw) {
    case "Submission":
      return "submission";
    case "Points":
      return "points";
    case "Ref Decision":
      return "ref_decision";
    case "DQ":
      return "dq";
    case "Injury":
      return "injury";
    case null:
      return null;
    default:
      return "unknown";
  }
}

function buildParentMediaRefs(
  match: CompetitionDetailMatchSnapshot,
): SyncedCompetitionMatchTopology["parentMediaRefs"] {
  const refs: NonNullable<SyncedCompetitionMatchTopology["parentMediaRefs"]> = [];
  const imageUri = typeof match.imageUri === "string" ? match.imageUri.trim() : "";
  const imageAssetId =
    typeof match.imageAssetId === "string" ? match.imageAssetId.trim() : "";
  if (imageUri || imageAssetId) {
    refs.push({
      kind: "image",
      ...(imageAssetId ? { assetId: imageAssetId } : {}),
      ...(imageUri ? { uri: imageUri } : {}),
    });
  }
  const videoUri = typeof match.videoUri === "string" ? match.videoUri.trim() : "";
  const videoAssetId =
    typeof match.videoAssetId === "string" ? match.videoAssetId.trim() : "";
  if (videoUri || videoAssetId) {
    refs.push({
      kind: "video",
      ...(videoAssetId ? { assetId: videoAssetId } : {}),
      ...(videoUri ? { uri: videoUri } : {}),
    });
  }
  return refs.length > 0 ? refs : undefined;
}

function invalidLineage(reason: string, extra: Record<string, unknown>, traceId?: string): never {
  console.log("[COMP_TOPOLOGY_TRACE] build_rejected_invalid_lineage", {
    ...(traceId ? { traceId } : {}),
    reason,
    ...extra,
  });
  throw new Error(`Competition topology lineage invalid: ${reason}`);
}

function buildCompetitionRow(
  sharedAthleteId: string,
  entry: KidCompetitionEntryWithMatchDetail,
  traceId?: string,
): SyncedCompetitionTopology {
  const sharedCompetitionId = (entry.sharedCompetitionId ?? "").trim();
  if (!sharedCompetitionId) {
    return invalidLineage("missing_shared_competition_id", {
      sharedAthleteId,
      localEntryId: entry.id,
    }, traceId);
  }

  const seenMatchLineageKeys = new Set<string>();
  const matches = entry.matches.map((match, index): SyncedCompetitionMatchTopology => {
    const matchLineageKey = typeof match.id === "string" ? match.id.trim() : "";
    if (!matchLineageKey) {
      return invalidLineage("missing_match_lineage_key", {
        sharedAthleteId,
        sharedCompetitionId,
        ordinal: index + 1,
      }, traceId);
    }
    if (seenMatchLineageKeys.has(matchLineageKey)) {
      return invalidLineage("duplicate_match_lineage_key", {
        sharedAthleteId,
        sharedCompetitionId,
        matchLineageKey,
      }, traceId);
    }
    seenMatchLineageKeys.add(matchLineageKey);

    const submissionType = normalizeStoredSubmissionType(match.submissionType);
    const parentMediaRefs = buildParentMediaRefs(match);
    return {
      matchLineageKey,
      ordinal: index + 1,
      result: match.matchResult,
      finishType: normalizeFinishType(match.outcome),
      durationSeconds: parseMatchDurationSeconds(match.submissionTime),
      ...(submissionType ? { submissionType } : {}),
      ...(parentMediaRefs ? { parentMediaRefs } : {}),
    };
  });

  return {
    sharedCompetitionId,
    sharedAthleteId,
    competitionLineageKey: sharedCompetitionId,
    updatedAt: entry.updatedAt,
    matches,
  };
}

export function buildCompetitionTopologyArtifactFromEntries(
  sharedAthleteId: string,
  entries: readonly KidCompetitionEntryWithMatchDetail[],
  traceId?: string,
): SyncedCompetitionTopologyArtifact {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    return invalidLineage("missing_shared_athlete_id", {}, traceId);
  }

  const seenCompetitionIds = new Set<string>();
  const linkedEntries = entries.filter((entry) => Boolean(entry.sharedCompetitionId?.trim()));
  const competitions = linkedEntries.map((entry) => {
    const competition = buildCompetitionRow(athleteId, entry, traceId);
    if (seenCompetitionIds.has(competition.sharedCompetitionId)) {
      return invalidLineage("duplicate_shared_competition_id", {
        sharedAthleteId: athleteId,
        sharedCompetitionId: competition.sharedCompetitionId,
      }, traceId);
    }
    seenCompetitionIds.add(competition.sharedCompetitionId);
    return competition;
  });
  const totalMatches = competitions.reduce((sum, competition) => sum + competition.matches.length, 0);
  const artifact: SyncedCompetitionTopologyArtifact = {
    schemaVersion: 1,
    sharedAthleteId: athleteId,
    updatedAt: new Date().toISOString(),
    competitions,
  };
  console.log("[COMP_TOPOLOGY_TRACE] build_ok", {
    ...(traceId ? { traceId } : {}),
    sharedAthleteId: athleteId,
    competitionCount: competitions.length,
    totalMatches,
    matchCounts: competitions.map((competition) => ({
      sharedCompetitionId: competition.sharedCompetitionId,
      matchCount: competition.matches.length,
    })),
    updatedAt: artifact.updatedAt,
  });
  logCompetitionTopologyTrace("[COMP_TOPOLOGY_TRACE]", "build_summary", {
    traceId: traceId ?? null,
    sharedAthleteId: athleteId,
    competitionCount: competitions.length,
    totalMatchCount: totalMatches,
    lineageKeyCount: totalMatches,
    updatedAt: artifact.updatedAt,
  });
  return artifact;
}

/** Parent-only: builds a full overwrite artifact from canonical shell + detail storage. */
export async function buildCompetitionTopologyArtifact(
  sharedAthleteId: string,
  traceId?: string,
): Promise<SyncedCompetitionTopologyArtifact> {
  const athleteId = sharedAthleteId.trim();
  const entries = athleteId
    ? await getKidCompetitionEntriesWithMatchDetailForSharedAthlete(athleteId)
    : [];
  return buildCompetitionTopologyArtifactFromEntries(athleteId, entries, traceId);
}
