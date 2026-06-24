import type {
  KidCompetitionEntryWithMatchDetail,
  CompetitionDetailMatchSnapshot,
} from "../../storage/competitionStore";
import {
  kidCompetitionEntryIsSyncedFromWorker,
  kidCompetitionEntryWorkerId,
} from "../../types/coachKid";
import type {
  SyncedCoachMatchBreakdownArtifactSet,
  SyncedCompetitionTopologyArtifact,
} from "../../types/coachWeeklySync";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "./mergeCoachBreakdownIntoMatches";
import {
  competitionOverlayAnnotationsFromEmbeddedMatches,
  deriveCompetitionProjectionSource,
  projectCompetitionCompeteView,
  selectCompetitionOverlayAnnotations,
  type CompetitionMatchOverlayAnnotation,
} from "./projectCompetitionCompeteView";
import type {
  CompetitionAnalysisMatch,
  CompetitionAnalysisRow,
  CompetitionAnalysisSource,
} from "./competitionAnalysisProjectionTypes";

export type CompetitionAnalysisProjectionEntry = {
  entry: KidCompetitionEntryWithMatchDetail;
  coachOverlayAnnotations?: readonly CompetitionMatchOverlayAnnotation[];
};

export type ProjectSharedCompetitionAnalysisInput = {
  deviceRole: "parent" | "coach";
  sharedAthleteId: string;
  competitions: readonly CompetitionAnalysisProjectionEntry[];
  artifactSet?: SyncedCoachMatchBreakdownArtifactSet | null;
  topologyArtifact?: SyncedCompetitionTopologyArtifact | null;
};

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function annotationsByLineage(
  annotations: readonly CompetitionMatchOverlayAnnotation[],
): Map<string, CompetitionMatchOverlayAnnotation> {
  const byLineage = new Map<string, CompetitionMatchOverlayAnnotation>();
  for (const annotation of annotations) {
    const lineageKey = trimmed(annotation.matchLineageKey);
    if (lineageKey && trimmed(annotation.coachNote)) {
      byLineage.set(lineageKey, annotation);
    }
  }
  return byLineage;
}

function toAnalysisMatch(
  match: CompetitionDetailMatchSnapshot,
  sourceByLineage: ReadonlyMap<string, CompetitionAnalysisSource>,
): CompetitionAnalysisMatch {
  const matchId = trimmed(match.id);
  const resolvedCoachAnalysis = trimmed(match.coachNote) || null;
  return {
    matchId,
    matchResult: match.matchResult,
    outcome: match.outcome,
    submissionTime: match.submissionTime,
    ...(match.submissionType !== undefined ? { submissionType: match.submissionType } : {}),
    resolvedCoachAnalysis,
    analysisSource: resolvedCoachAnalysis
      ? sourceByLineage.get(matchId) ?? "embedded_compatibility"
      : "none",
  };
}

function parentLinkedMatches(input: {
  entry: KidCompetitionEntryWithMatchDetail;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
}): CompetitionAnalysisMatch[] {
  const annotations = overlayAnnotationsFromCoachMatchBreakdownArtifactSet({
    artifactSet: input.artifactSet,
    sharedAthleteId: input.sharedAthleteId,
    sharedCompetitionId: input.sharedCompetitionId,
    matchLineageKeys: input.entry.matches.map((match) => match.id),
  });
  const mergedMatches = mergeCoachBreakdownIntoMatches({
    matches: input.entry.matches,
    overlayAnnotations: annotations,
    sharedAthleteId: input.sharedAthleteId,
    sharedCompetitionId: input.sharedCompetitionId,
  });
  const sourceByLineage = new Map<string, CompetitionAnalysisSource>();
  for (const lineageKey of annotationsByLineage(annotations).keys()) {
    sourceByLineage.set(lineageKey, "coach_artifact");
  }
  return mergedMatches.map((match) => toAnalysisMatch(match, sourceByLineage));
}

function coachLinkedMatches(input: {
  entry: KidCompetitionEntryWithMatchDetail;
  topologyArtifact: SyncedCompetitionTopologyArtifact | null;
  coachOverlayAnnotations: readonly CompetitionMatchOverlayAnnotation[];
}): CompetitionAnalysisMatch[] {
  const localAnnotations = [...input.coachOverlayAnnotations];
  const compatibilityAnnotations =
    competitionOverlayAnnotationsFromEmbeddedMatches(input.entry.matches);
  const overlaySelection = selectCompetitionOverlayAnnotations({
    hydratedAnnotations: localAnnotations,
    embeddedAnnotations: compatibilityAnnotations,
  });
  const overlayAnnotations = overlaySelection.annotations;
  const projectionSource = deriveCompetitionProjectionSource({
    shell: input.entry,
    topologyArtifact: input.topologyArtifact,
    fallbackMatches: input.entry.matches,
  });
  const projected = projectCompetitionCompeteView({
    shell: input.entry,
    topologyArtifact: input.topologyArtifact,
    overlayAnnotations,
    fallbackMatches: input.entry.matches,
  });
  const sourceByLineage = new Map<string, CompetitionAnalysisSource>();
  if (projectionSource === "topology_projection_used") {
    const source: CompetitionAnalysisSource =
      overlaySelection.source === "hydrated_annotations"
        ? "coach_overlay"
        : "embedded_compatibility";
    for (const lineageKey of annotationsByLineage(overlayAnnotations).keys()) {
      sourceByLineage.set(lineageKey, source);
    }
  }
  return projected.matches.map((match) => toAnalysisMatch(match, sourceByLineage));
}

function detailMatches(
  matches: readonly CompetitionDetailMatchSnapshot[],
): CompetitionAnalysisMatch[] {
  return matches.map((match) => toAnalysisMatch(match, new Map()));
}

export function projectSharedCompetitionAnalysis(
  input: ProjectSharedCompetitionAnalysisInput,
): CompetitionAnalysisRow[] {
  const sharedAthleteId = trimmed(input.sharedAthleteId);
  const artifactSet = input.artifactSet ?? null;
  const topologyArtifact = input.topologyArtifact ?? null;

  return input.competitions.map(({ entry, coachOverlayAnnotations = [] }) => {
    const linked = kidCompetitionEntryIsSyncedFromWorker(entry);
    const sharedCompetitionId = linked ? kidCompetitionEntryWorkerId(entry) : "";
    const entrySharedAthleteId = trimmed(entry.sharedAthleteId);
    const linkedScopeValid =
      linked &&
      Boolean(sharedAthleteId) &&
      Boolean(entrySharedAthleteId) &&
      sharedAthleteId === entrySharedAthleteId;
    const matches = !linked
      ? detailMatches(entry.matches)
      : !linkedScopeValid
        ? detailMatches(entry.matches)
        : input.deviceRole === "parent"
          ? parentLinkedMatches({
              entry,
              sharedAthleteId,
              sharedCompetitionId,
              artifactSet,
            })
          : coachLinkedMatches({
              entry,
              topologyArtifact,
              coachOverlayAnnotations,
            });

    return {
      entryId: trimmed(entry.id),
      sharedCompetitionId: sharedCompetitionId || null,
      eventDate: entry.eventDate,
      result: entry.result ?? null,
      createdAt: entry.createdAt,
      competitionCoachNotes: trimmed(entry.coachNotes) || null,
      matches,
    };
  });
}
