import type {
  CoachAnalysisReadinessLinkEvidence,
  CoachAnalysisReadinessResolution,
} from "./coachAnalysisReadinessTypes";

function latestTimestamp(values: readonly string[]): string | undefined {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];
}

export function resolveCoachAnalysisReadinessForAthlete(input: {
  sharedAthleteId: string;
  links: readonly CoachAnalysisReadinessLinkEvidence[];
}): CoachAnalysisReadinessResolution {
  const athleteId = input.sharedAthleteId.trim();
  if (!athleteId || input.links.length === 0) {
    return { state: "PENDING" };
  }

  const populatedTimestamps: string[] = [];
  let hasExplicitEmpty = false;
  let hasPending = false;
  let hasFailureEvidence = false;

  for (const link of input.links) {
    if (link.status === "pending") {
      hasPending = true;
      continue;
    }
    if (link.status === "failed") {
      hasFailureEvidence = true;
      continue;
    }

    const athleteClassification =
      link.artifactEvidence.athleteEntryClassificationById[athleteId];
    if (athleteClassification === "populated") {
      const updatedAt =
        link.artifactSetUpdatedAtByAthleteId?.[athleteId]?.trim() ?? "";
      if (updatedAt) populatedTimestamps.push(updatedAt);
      continue;
    }
    if (athleteClassification === "empty") {
      hasExplicitEmpty = true;
      continue;
    }
    if (athleteClassification === "malformed") {
      hasFailureEvidence = true;
      continue;
    }

    if (link.artifactEvidence.fieldClassification === "malformed") {
      hasFailureEvidence = true;
    } else if (link.artifactEvidence.fieldClassification === "omitted") {
      hasFailureEvidence = true;
    } else {
      hasFailureEvidence = true;
    }
  }

  if (populatedTimestamps.length > 0) {
    return {
      state: "READY",
      artifactSetUpdatedAt: latestTimestamp(populatedTimestamps),
    };
  }
  if (
    input.links.some(
      (link) =>
        link.status === "success" &&
        link.artifactEvidence.athleteEntryClassificationById[athleteId] ===
          "populated",
    )
  ) {
    return { state: "READY" };
  }
  if (hasExplicitEmpty) {
    return { state: "EMPTY_READY" };
  }
  if (hasPending) {
    return { state: "PENDING" };
  }
  if (hasFailureEvidence) {
    return { state: "FAILED" };
  }
  return { state: "PENDING" };
}
