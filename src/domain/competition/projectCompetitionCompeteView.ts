import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";
import type { VoiceNoteRef } from "../../types/coachMatchBreakdownOverlay";
import type {
  SyncedCompetitionMatchTopology,
  SyncedCompetitionTopologyArtifact,
  SyncedCompetitionTopologyFinishType,
} from "../../types/coachWeeklySync";
import { logBreakdownPropagationForMatch } from "./competitionProjectionBreakdownTrace";

export type CompetitionMatchOverlayAnnotation = {
  matchLineageKey: string;
  coachNote?: string;
  voiceNoteRefs?: VoiceNoteRef[];
};

export type CompetitionCompeteView = KidCompetitionEntry & {
  matches: CompetitionDetailMatchSnapshot[];
};

export type CompetitionProjectionSource =
  | "topology_projection_used"
  | "fallback_missing_topology"
  | "fallback_cardinality_guard";

export type CompetitionOverlayAnnotationSelectionSource =
  | "hydrated_annotations"
  | "embedded_compatibility";

export function competitionOverlayAnnotationsFromEmbeddedMatches(
  matches: readonly CompetitionDetailMatchSnapshot[],
): CompetitionMatchOverlayAnnotation[] {
  return matches.map((match) => ({
    matchLineageKey: match.id,
    coachNote: match.coachNote,
    ...(match.voiceNoteRefs?.length ? { voiceNoteRefs: match.voiceNoteRefs } : {}),
  }));
}

export function selectCompetitionOverlayAnnotations(input: {
  hydratedAnnotations: readonly CompetitionMatchOverlayAnnotation[] | null;
  embeddedAnnotations: readonly CompetitionMatchOverlayAnnotation[];
}): {
  annotations: CompetitionMatchOverlayAnnotation[];
  source: CompetitionOverlayAnnotationSelectionSource;
} {
  if (input.hydratedAnnotations?.length) {
    return {
      annotations: [...input.hydratedAnnotations],
      source: "hydrated_annotations",
    };
  }
  return {
    annotations: [...input.embeddedAnnotations],
    source: "embedded_compatibility",
  };
}

function logProjectionComplete(
  sharedCompetitionId: string,
  matches: readonly CompetitionDetailMatchSnapshot[],
  overlaySource: string,
) {
  for (const match of matches) {
    logBreakdownPropagationForMatch({
      stage: "projection_complete",
      sharedCompetitionId,
      matchLineageKey: match.id,
      overlaySource,
      source: match,
    });
  }
}

function resolveTopologyCompetitionRow(input: {
  shell: KidCompetitionEntry;
  topologyArtifact: SyncedCompetitionTopologyArtifact | null;
}) {
  const sharedAthleteId = input.shell.sharedAthleteId?.trim() ?? "";
  const sharedCompetitionId = input.shell.sharedCompetitionId?.trim() ?? "";
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    input.topologyArtifact?.sharedAthleteId !== sharedAthleteId
  ) {
    return null;
  }
  return (
    input.topologyArtifact.competitions.find(
      (competition) => competition.sharedCompetitionId === sharedCompetitionId,
    ) ?? null
  );
}

/** Pure card-scoped projection arbitration for incident capture and Compete render. */
export function deriveCompetitionProjectionSource(input: {
  shell: KidCompetitionEntry;
  topologyArtifact: SyncedCompetitionTopologyArtifact | null;
  fallbackMatches: readonly CompetitionDetailMatchSnapshot[];
}): CompetitionProjectionSource {
  const topology = resolveTopologyCompetitionRow(input);
  if (!topology) {
    return "fallback_missing_topology";
  }
  if (topology.matches.length < input.fallbackMatches.length) {
    return "fallback_cardinality_guard";
  }
  return "topology_projection_used";
}

function outcomeFromFinishType(
  finishType: SyncedCompetitionTopologyFinishType,
): CompetitionDetailMatchSnapshot["outcome"] {
  switch (finishType) {
    case "submission":
      return "Submission";
    case "points":
      return "Points";
    case "ref_decision":
      return "Ref Decision";
    case "dq":
      return "DQ";
    case "injury":
      return "Injury";
    case "unknown":
    case null:
      return null;
  }
}

function mediaRefForKind(
  match: SyncedCompetitionMatchTopology,
  kind: "image" | "video",
): { assetId: string | null; uri: string | null } {
  const ref = match.parentMediaRefs?.find((candidate) => candidate.kind === kind);
  return {
    assetId: ref?.assetId?.trim() || null,
    uri: ref?.uri?.trim() || null,
  };
}

function snapshotFromTopologyMatch(
  match: SyncedCompetitionMatchTopology,
  overlay: CompetitionMatchOverlayAnnotation | null,
): CompetitionDetailMatchSnapshot {
  const image = mediaRefForKind(match, "image");
  const video = mediaRefForKind(match, "video");
  const coachNote = overlay?.coachNote?.trim();
  const voiceNoteRefs = overlay?.voiceNoteRefs;
  return {
    id: match.matchLineageKey,
    matchResult: match.result,
    outcome: outcomeFromFinishType(match.finishType),
    submissionTime: match.durationSeconds === null ? null : String(match.durationSeconds),
    ...(match.submissionType ? { submissionType: match.submissionType } : {}),
    ...(coachNote ? { coachNote } : {}),
    ...(voiceNoteRefs?.length ? { voiceNoteRefs } : {}),
    imageUri: image.uri,
    videoUri: video.uri,
    imageAssetId: image.assetId,
    videoAssetId: video.assetId,
  };
}

/**
 * Ephemeral coach Compete projection. Canonical topology owns structural facts; lineage-keyed
 * annotations may add commentary only. The merged view is returned to rendering and never persisted.
 */
export function projectCompetitionCompeteView(input: {
  shell: KidCompetitionEntry;
  topologyArtifact: SyncedCompetitionTopologyArtifact | null;
  overlayAnnotations?: readonly CompetitionMatchOverlayAnnotation[];
  fallbackMatches: readonly CompetitionDetailMatchSnapshot[];
}): CompetitionCompeteView {
  const { shell, topologyArtifact, fallbackMatches } = input;
  const sharedAthleteId = shell.sharedAthleteId?.trim() ?? "";
  const sharedCompetitionId = shell.sharedCompetitionId?.trim() ?? "";
  const topology = resolveTopologyCompetitionRow({ shell, topologyArtifact });
  const projectionSource = deriveCompetitionProjectionSource({
    shell,
    topologyArtifact,
    fallbackMatches,
  });

  if (topology) {
    for (const match of topology.matches) {
      logBreakdownPropagationForMatch({
        stage: "canonical_selected",
        sharedCompetitionId,
        matchLineageKey: match.matchLineageKey,
        overlaySource: "canonical_topology",
      });
    }
  }

  {
    const canonicalLineageKeys = topology?.matches.map((match) => match.matchLineageKey) ?? [];
    const canonicalLineageKeySet = new Set(canonicalLineageKeys);
    const overlaysByInputKey = new Map<string, CompetitionMatchOverlayAnnotation>();
    for (const overlay of input.overlayAnnotations ?? []) {
      const matchLineageKey = overlay.matchLineageKey.trim();
      if (matchLineageKey) overlaysByInputKey.set(matchLineageKey, overlay);
    }
    for (const matchLineageKey of canonicalLineageKeys) {
      const overlay = overlaysByInputKey.get(matchLineageKey) ?? null;
      logBreakdownPropagationForMatch({
        stage: "overlay_join",
        sharedCompetitionId,
        matchLineageKey,
        overlaySource: overlay ? "overlay_annotation_matched" : "overlay_annotation_missing",
        source: overlay ?? undefined,
      });
    }
    for (const overlay of input.overlayAnnotations ?? []) {
      const matchLineageKey = overlay.matchLineageKey.trim();
      if (!matchLineageKey || canonicalLineageKeySet.has(matchLineageKey)) continue;
      logBreakdownPropagationForMatch({
        stage: "overlay_join",
        sharedCompetitionId,
        matchLineageKey,
        overlaySource: "overlay_annotation_unmatched",
        source: overlay,
      });
    }
  }

  if (projectionSource === "fallback_missing_topology") {
    console.log("[COACH_TOPOLOGY_TRACE]", {
      stage: "coach_compete_projection",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      projectedMatchCount: fallbackMatches.length,
      topologyMatchCount: 0,
      fallbackMatchCount: fallbackMatches.length,
      incomingUpdatedAt: topologyArtifact?.updatedAt ?? null,
      existingUpdatedAt: null,
      projectionSource,
    });
    console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
      stage: "coach_compete_projection",
      sharedCompetitionId: sharedCompetitionId || null,
      updatedAt: topologyArtifact?.updatedAt ?? null,
      matchCount: fallbackMatches.length,
      firstFiveMatchIds: fallbackMatches.slice(0, 5).map((match) => match.id),
      firstFiveMatchResults: fallbackMatches.slice(0, 5).map((match) => match.matchResult),
      accepted: false,
      overwriteReason: "missing_topology_fallback_used",
    });
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "overlay_merge_skipped_missing_topology",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      artifactCount: input.overlayAnnotations?.length ?? 0,
      mergeCount: 0,
      parentRenderCount: 0,
      reason: "missing_canonical_topology",
    });
    if (__DEV__) {
      console.log("[COMP_PROJECTION_TRACE] projection_missing_topology", {
        sharedAthleteId: sharedAthleteId || null,
        sharedCompetitionId: sharedCompetitionId || null,
        canonicalLineageAvailable: false,
        overlayAttachEligible: false,
      });
      console.log("[COMP_PROJECTION_TRACE] projection_fallback_used", {
        sharedAthleteId: sharedAthleteId || null,
        sharedCompetitionId: sharedCompetitionId || null,
        fallbackMatchCount: fallbackMatches.length,
      });
    }
    logProjectionComplete(sharedCompetitionId, fallbackMatches, "fallback_missing_topology");
    return { ...shell, matches: [...fallbackMatches] };
  }

  if (projectionSource === "fallback_cardinality_guard") {
    if (!topology) {
      logProjectionComplete(sharedCompetitionId, fallbackMatches, "fallback_cardinality_guard");
      return { ...shell, matches: [...fallbackMatches] };
    }
    console.log("[COACH_TOPOLOGY_TRACE]", {
      stage: "coach_compete_projection",
      sharedAthleteId,
      sharedCompetitionId,
      projectedMatchCount: fallbackMatches.length,
      topologyMatchCount: topology.matches.length,
      fallbackMatchCount: fallbackMatches.length,
      incomingUpdatedAt: topologyArtifact?.updatedAt ?? null,
      existingUpdatedAt: null,
      projectionSource,
    });
    console.log("[COMPETE_PROJECTION_TRACE]", {
      arbitration: projectionSource,
      sharedCompetitionId: shell.id,
      topologyMatchCount: topology?.matches.length ?? 0,
      fallbackMatchCount: fallbackMatches.length,
    });

    logProjectionComplete(sharedCompetitionId, fallbackMatches, "fallback_cardinality_guard");
    return {
      ...shell,
      matches: [...fallbackMatches],
    };
  }

  if (!topology) {
    logProjectionComplete(sharedCompetitionId, fallbackMatches, "fallback_missing_topology");
    return { ...shell, matches: [...fallbackMatches] };
  }

  const overlaysByLineageKey = new Map<string, CompetitionMatchOverlayAnnotation>();
  for (const overlay of input.overlayAnnotations ?? []) {
    const matchLineageKey = overlay.matchLineageKey.trim();
    if (matchLineageKey) overlaysByLineageKey.set(matchLineageKey, overlay);
  }

  let attachedOverlayCount = 0;
  const matches = [...topology.matches]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((match) => {
      const overlay = overlaysByLineageKey.get(match.matchLineageKey) ?? null;
      if (overlay) attachedOverlayCount += 1;
      return snapshotFromTopologyMatch(match, overlay);
    });

  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "overlay_merge_complete",
    sharedAthleteId,
    sharedCompetitionId,
    lineageIds: topology.matches.map((match) => match.matchLineageKey),
    artifactCount: overlaysByLineageKey.size,
    mergeCount: attachedOverlayCount,
    parentRenderCount: matches.filter((match) => (match.coachNote ?? "").trim().length > 0).length,
  });
  console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
    stage: "coach_compete_projection",
    sharedCompetitionId,
    updatedAt: topologyArtifact?.updatedAt ?? null,
    matchCount: matches.length,
    firstFiveMatchIds: matches.slice(0, 5).map((match) => match.id),
    firstFiveMatchResults: matches.slice(0, 5).map((match) => match.matchResult),
    accepted: true,
    overwriteReason: "topology_projection_used",
  });
  console.log("[COACH_TOPOLOGY_TRACE]", {
    stage: "coach_compete_projection",
    sharedAthleteId,
    sharedCompetitionId,
    projectedMatchCount: matches.length,
    topologyMatchCount: topology.matches.length,
    fallbackMatchCount: fallbackMatches.length,
    incomingUpdatedAt: topologyArtifact?.updatedAt ?? null,
    existingUpdatedAt: null,
    projectionSource,
  });
  if (__DEV__) {
    console.log("[COMP_PROJECTION_TRACE] projection_topology_used", {
      sharedAthleteId,
      sharedCompetitionId,
      matchCount: matches.length,
      lineageKeyCount: topology.matches.length,
      canonicalLineageAvailable: true,
      overlayAttachEligible: true,
    });
    if (attachedOverlayCount > 0) {
      console.log("[COMP_PROJECTION_TRACE] projection_overlay_attached", {
        sharedAthleteId,
        sharedCompetitionId,
        attachmentCount: attachedOverlayCount,
      });
    }
    if (overlaysByLineageKey.size > attachedOverlayCount) {
      console.log("[COMP_PROJECTION_TRACE] projection_missing_overlay_attachment", {
        sharedAthleteId,
        sharedCompetitionId,
        missingAttachmentCount: overlaysByLineageKey.size - attachedOverlayCount,
      });
    }
  }

  logProjectionComplete(sharedCompetitionId, matches, "topology_projection_used");
  return { ...shell, matches };
}
