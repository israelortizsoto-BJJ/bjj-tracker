import type {
  CoachMatchBreakdownArtifactParseEvidence,
  SyncedCoachMatchBreakdownArtifact,
  SyncedCoachMatchBreakdownArtifactSet,
} from "../types/coachWeeklySync";

function isSyncedCoachMatchBreakdownArtifact(
  value: unknown,
): value is SyncedCoachMatchBreakdownArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact.sharedAthleteId === "string" &&
    typeof artifact.sharedCompetitionId === "string" &&
    typeof artifact.matchLineageKey === "string" &&
    typeof artifact.updatedAt === "string" &&
    (artifact.coachNote === undefined || typeof artifact.coachNote === "string")
  );
}

function isSyncedCoachMatchBreakdownArtifactSet(
  value: unknown,
): value is SyncedCoachMatchBreakdownArtifactSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifactSet = value as Record<string, unknown>;
  if (
    artifactSet.schemaVersion !== 1 ||
    typeof artifactSet.sharedAthleteId !== "string" ||
    typeof artifactSet.updatedAt !== "string" ||
    !Array.isArray(artifactSet.artifacts)
  ) {
    return false;
  }
  const identityKeys = new Set<string>();
  for (const artifact of artifactSet.artifacts) {
    if (!isSyncedCoachMatchBreakdownArtifact(artifact)) return false;
    if (
      artifact.sharedAthleteId.trim() !==
      artifactSet.sharedAthleteId.trim()
    ) {
      return false;
    }
    const key = JSON.stringify([
      artifact.sharedAthleteId.trim(),
      artifact.sharedCompetitionId.trim(),
      artifact.matchLineageKey.trim(),
    ]);
    if (identityKeys.has(key)) return false;
    identityKeys.add(key);
  }
  return true;
}

export function parseCoachMatchBreakdownArtifactsField(
  raw: unknown,
  fieldPresent = true,
): {
  artifactsByAthleteId: Record<string, SyncedCoachMatchBreakdownArtifactSet>;
  evidence: CoachMatchBreakdownArtifactParseEvidence;
} {
  if (!fieldPresent) {
    return {
      artifactsByAthleteId: {},
      evidence: {
        fieldClassification: "omitted",
        athleteEntryClassificationById: {},
      },
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      artifactsByAthleteId: {},
      evidence: {
        fieldClassification: "malformed",
        athleteEntryClassificationById: {},
      },
    };
  }
  const artifactsByAthleteId: Record<
    string,
    SyncedCoachMatchBreakdownArtifactSet
  > = {};
  const athleteEntryClassificationById: CoachMatchBreakdownArtifactParseEvidence["athleteEntryClassificationById"] =
    {};
  let fieldClassification: CoachMatchBreakdownArtifactParseEvidence["fieldClassification"] =
    "valid";
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const athleteId = key.trim();
    if (!athleteId) {
      fieldClassification = "malformed";
      continue;
    }
    if (
      !isSyncedCoachMatchBreakdownArtifactSet(value) ||
      value.sharedAthleteId.trim() !== athleteId
    ) {
      fieldClassification = "malformed";
      athleteEntryClassificationById[athleteId] = "malformed";
      continue;
    }
    artifactsByAthleteId[athleteId] = value;
    athleteEntryClassificationById[athleteId] =
      value.artifacts.length > 0 ? "populated" : "empty";
  }
  return {
    artifactsByAthleteId,
    evidence: {
      fieldClassification,
      athleteEntryClassificationById,
    },
  };
}
