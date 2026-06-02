import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";
import type { SyncedCompetitionTopologyArtifact } from "../../types/coachWeeklySync";
import {
  projectCompetitionCompeteView,
  type CompetitionMatchOverlayAnnotation,
} from "./projectCompetitionCompeteView";

export type CompetitionEditorProjection = {
  source: "canonical_topology" | "legacy_fallback";
  matches: CompetitionDetailMatchSnapshot[];
  sharedAthleteId: string | null;
  sharedCompetitionId: string | null;
};

function trimmedOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function logEditorTrace(event: string, details: Record<string, unknown>) {
  if (__DEV__) {
    console.log("[COMP_EDITOR_TRACE]", event, details);
  }
}

export function projectCompetitionEditorView(input: {
  shell: KidCompetitionEntry;
  topologyArtifact: SyncedCompetitionTopologyArtifact | null;
  overlayAnnotations?: readonly CompetitionMatchOverlayAnnotation[];
  fallbackMatches: readonly CompetitionDetailMatchSnapshot[];
}): CompetitionEditorProjection {
  const sharedAthleteId = trimmedOrNull(input.shell.sharedAthleteId);
  const sharedCompetitionId = trimmedOrNull(input.shell.sharedCompetitionId);
  const topology =
    input.topologyArtifact?.sharedAthleteId === sharedAthleteId
      ? input.topologyArtifact.competitions.find(
          (competition) =>
            competition.sharedCompetitionId === sharedCompetitionId &&
            competition.sharedAthleteId === sharedAthleteId
        )
      : null;

  if (!sharedAthleteId || !sharedCompetitionId || !topology) {
    logEditorTrace("editor_missing_topology", {
      hasSharedAthleteId: Boolean(sharedAthleteId),
      hasSharedCompetitionId: Boolean(sharedCompetitionId),
    });
    logEditorTrace("editor_fallback_used", {
      matchCount: input.fallbackMatches.length,
    });
    return {
      source: "legacy_fallback",
      matches: [...input.fallbackMatches],
      sharedAthleteId,
      sharedCompetitionId,
    };
  }

  const canonicalLineageKeys = new Set(
    topology.matches.map((match) => match.matchLineageKey)
  );
  const missingAttachmentCount = (input.overlayAnnotations ?? []).filter(
    (annotation) => !canonicalLineageKeys.has(annotation.matchLineageKey)
  ).length;
  if (missingAttachmentCount > 0) {
    logEditorTrace("editor_missing_overlay_attachment", {
      missingAttachmentCount,
    });
  }

  const projection = projectCompetitionCompeteView({
    shell: input.shell,
    topologyArtifact: input.topologyArtifact,
    overlayAnnotations: input.overlayAnnotations,
    fallbackMatches: input.fallbackMatches,
  });
  const loadedOverlayCount = (input.overlayAnnotations ?? []).filter(
    (annotation) =>
      canonicalLineageKeys.has(annotation.matchLineageKey) &&
      Boolean(annotation.coachNote)
  ).length;

  logEditorTrace("editor_topology_used", {
    matchCount: projection.matches.length,
  });
  if (loadedOverlayCount > 0) {
    logEditorTrace("editor_overlay_loaded", {
      overlayCount: loadedOverlayCount,
    });
  }

  return {
    source: "canonical_topology",
    matches: projection.matches,
    sharedAthleteId,
    sharedCompetitionId,
  };
}
