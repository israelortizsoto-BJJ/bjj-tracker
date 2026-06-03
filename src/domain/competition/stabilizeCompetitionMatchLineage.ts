import {
  getCompetitionDetailByEntryId,
  type CompetitionDetailMatchSnapshot,
} from "../../storage/competitionStore";

const TRANSIENT_MATCH_ID_PATTERN = /^match-(new|init|legacy)-/;

type StabilizeInput = {
  entryId: string;
  sharedAthleteId: string | null | undefined;
  sharedCompetitionId: string | null | undefined;
  matches: readonly CompetitionDetailMatchSnapshot[];
  source: string;
};

function normalizedId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isTransientMatchLineageId(value: string | null | undefined): boolean {
  const id = normalizedId(value);
  return !id || TRANSIENT_MATCH_ID_PATTERN.test(id);
}

function safeLineageSegment(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_-]+/g, "_");
  return normalized || "unknown";
}

function generatedCanonicalMatchLineageId(sharedCompetitionId: string, ordinal: number): string {
  return `match-lineage-${safeLineageSegment(sharedCompetitionId)}-slot-${ordinal}`;
}

function logLineageStabilizeTrace(phase: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log("[LINEAGE_STABILIZE_TRACE]", phase, payload);
}

function firstStableUnusedCandidate(
  candidates: readonly (string | null | undefined)[],
  used: Set<string>,
): string | null {
  for (const candidate of candidates) {
    const id = normalizedId(candidate);
    if (!id || isTransientMatchLineageId(id) || used.has(id)) continue;
    return id;
  }
  return null;
}

export async function stabilizeCompetitionMatchLineageBeforePersist({
  entryId,
  sharedAthleteId,
  sharedCompetitionId,
  matches,
  source,
}: StabilizeInput): Promise<CompetitionDetailMatchSnapshot[]> {
  const athleteId = normalizedId(sharedAthleteId);
  const competitionId = normalizedId(sharedCompetitionId);
  if (!athleteId || !competitionId) {
    logLineageStabilizeTrace("skipped_unlinked", {
      source,
      entryId,
      sharedAthleteId: athleteId || null,
      sharedCompetitionId: competitionId || null,
      incomingIds: matches.map((m) => m.id),
    });
    return matches.map((m) => ({ ...m }));
  }

  const existingDetail = await getCompetitionDetailByEntryId(entryId);
  const priorMatches = Array.isArray(existingDetail?.matches) ? existingDetail.matches : [];
  const used = new Set<string>();
  const generatedIds: string[] = [];
  const remappedIds: {
    ordinal: number;
    from: string | null;
    to: string;
    reason: string;
  }[] = [];

  const stabilized = matches.map((match, index) => {
    const ordinal = index + 1;
    const incomingId = normalizedId(match.id);
    const priorSlotId = normalizedId(priorMatches[index]?.id);
    const preserved = firstStableUnusedCandidate([incomingId, priorSlotId], used);
    if (preserved) {
      used.add(preserved);
      if (preserved !== incomingId) {
        remappedIds.push({
          ordinal,
          from: incomingId || null,
          to: preserved,
          reason: "prior_persisted_slot",
        });
      }
      return { ...match, id: preserved };
    }

    const generated = generatedCanonicalMatchLineageId(competitionId, ordinal);
    used.add(generated);
    generatedIds.push(generated);
    remappedIds.push({
      ordinal,
      from: incomingId || null,
      to: generated,
      reason: incomingId ? "transient_or_duplicate_replaced" : "missing_lineage_generated",
    });
    return { ...match, id: generated };
  });

  logLineageStabilizeTrace("complete", {
    source,
    entryId,
    sharedAthleteId: athleteId,
    sharedCompetitionId: competitionId,
    incomingIds: matches.map((m) => m.id),
    priorPersistedSlotIds: priorMatches.map((m) => m.id),
    outgoingIds: stabilized.map((m) => m.id),
    remappedIds,
    generatedIds,
  });

  return stabilized;
}
