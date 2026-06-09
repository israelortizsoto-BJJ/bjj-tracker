import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";
import type {
  SyncedCompetitionMatchTopology,
  SyncedCompetitionTopologyArtifact,
  SyncedCompetitionTopologyFinishType,
} from "../../types/coachWeeklySync";

export type CompetitionMatchOverlayAnnotation = {
  matchLineageKey: string;
  coachNote?: string;
};

export type CompetitionCompeteView = KidCompetitionEntry & {
  matches: CompetitionDetailMatchSnapshot[];
};

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
  return {
    id: match.matchLineageKey,
    matchResult: match.result,
    outcome: outcomeFromFinishType(match.finishType),
    submissionTime: match.durationSeconds === null ? null : String(match.durationSeconds),
    ...(match.submissionType ? { submissionType: match.submissionType } : {}),
    ...(coachNote ? { coachNote } : {}),
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
  const topology =
    sharedAthleteId && sharedCompetitionId && topologyArtifact?.sharedAthleteId === sharedAthleteId
      ? topologyArtifact.competitions.find(
          (competition) => competition.sharedCompetitionId === sharedCompetitionId,
        ) ?? null
      : null;

  if (!topology) {
    console.log("[COACH_TOPOLOGY_TRACE]", {
      stage: "coach_compete_projection",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      projectedMatchCount: fallbackMatches.length,
      topologyMatchCount: 0,
      fallbackMatchCount: fallbackMatches.length,
      incomingUpdatedAt: topologyArtifact?.updatedAt ?? null,
      existingUpdatedAt: null,
      projectionSource: "fallback_missing_topology",
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
    return { ...shell, matches: [...fallbackMatches] };
  }

  if (topology.matches.length < fallbackMatches.length) {
    console.log("[COACH_TOPOLOGY_TRACE]", {
      stage: "coach_compete_projection",
      sharedAthleteId,
      sharedCompetitionId,
      projectedMatchCount: fallbackMatches.length,
      topologyMatchCount: topology.matches.length,
      fallbackMatchCount: fallbackMatches.length,
      incomingUpdatedAt: topologyArtifact?.updatedAt ?? null,
      existingUpdatedAt: null,
      projectionSource: "fallback_cardinality_guard",
    });
    console.log("[COMPETE_PROJECTION_TRACE]", {
      arbitration: "fallback_cardinality_guard",
      sharedCompetitionId: shell.id,
      topologyMatchCount: topology.matches.length,
      fallbackMatchCount: fallbackMatches.length,
    });

    return {
      ...shell,
      matches: [...fallbackMatches],
    };
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
    projectionSource: "topology_projection_used",
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

  return { ...shell, matches };
}
