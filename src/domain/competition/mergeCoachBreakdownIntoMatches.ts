import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";
import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";
import { logMatchBreakdownBoundaryProbe } from "../../dev/matchBreakdownBoundaryProbe";
import type { CompetitionMatchOverlayAnnotation } from "./projectCompetitionCompeteView";

function slotKeyFromLineageKey(matchLineageKey: string): string | null {
  const trimmed = matchLineageKey.trim();
  const slotMatch = /-slot-(\d+)$/.exec(trimmed);
  return slotMatch ? `slot-${slotMatch[1]}` : null;
}

export function overlayAnnotationsFromCoachMatchBreakdownArtifactSet(input: {
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKeys: readonly string[];
}): CompetitionMatchOverlayAnnotation[] {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const sharedCompetitionId = input.sharedCompetitionId.trim();
  const lineageKeys = new Set(input.matchLineageKeys.map((key) => key.trim()).filter(Boolean));

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_to_overlay_annotations_begin",
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    artifactSetPresent: Boolean(input.artifactSet),
    artifactSetAthleteId: input.artifactSet?.sharedAthleteId.trim() ?? null,
    artifactCount: input.artifactSet?.artifacts.length ?? 0,
    matchLineageKeyCount: lineageKeys.size,
    matchLineageKeys: [...lineageKeys],
    slotKeys: [...lineageKeys].map((key) => slotKeyFromLineageKey(key)),
  });

  if (!input.artifactSet) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_to_overlay_annotations_skip",
      reason: "missing_artifact_set",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
    });
    return [];
  }
  if (input.artifactSet.sharedAthleteId.trim() !== sharedAthleteId) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_to_overlay_annotations_skip",
      reason: "artifact_set_athlete_mismatch",
      sharedAthleteId: sharedAthleteId || null,
      artifactSetAthleteId: input.artifactSet.sharedAthleteId.trim(),
      sharedCompetitionId: sharedCompetitionId || null,
    });
    return [];
  }
  if (!sharedAthleteId) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_to_overlay_annotations_skip",
      reason: "empty_sharedAthleteId",
      sharedCompetitionId: sharedCompetitionId || null,
    });
    return [];
  }
  if (!sharedCompetitionId) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_to_overlay_annotations_skip",
      reason: "empty_sharedCompetitionId",
      sharedAthleteId,
    });
    return [];
  }
  if (lineageKeys.size === 0) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_to_overlay_annotations_skip",
      reason: "empty_match_lineage_keys",
      sharedAthleteId,
      sharedCompetitionId,
      artifactCount: input.artifactSet.artifacts.length,
    });
    return [];
  }

  const annotations: CompetitionMatchOverlayAnnotation[] = [];
  for (const artifact of input.artifactSet.artifacts) {
    const artifactAthleteId = artifact.sharedAthleteId.trim();
    const artifactCompetitionId = artifact.sharedCompetitionId.trim();
    const artifactLineageKey = artifact.matchLineageKey.trim();
    const hasCoachNote = Boolean(artifact.coachNote?.trim());
    const exactLineageMatch = lineageKeys.has(artifactLineageKey);
    let skipReason: string | null = null;
    if (artifactAthleteId !== sharedAthleteId) skipReason = "athlete_mismatch";
    else if (artifactCompetitionId !== sharedCompetitionId) skipReason = "competition_mismatch";
    else if (!exactLineageMatch) skipReason = "lineage_key_not_in_match_set";
    else if (!hasCoachNote) skipReason = "empty_coach_note";

    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: skipReason ? "artifact_to_overlay_annotations_skip_item" : "artifact_to_overlay_annotations_accept_item",
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey: artifactLineageKey,
      slotKey: slotKeyFromLineageKey(artifactLineageKey),
      matchId: artifactLineageKey,
      exactLineageMatch,
      hasCoachNote,
      reason: skipReason,
      entryMatchLineageKeys: [...lineageKeys],
    });

    if (skipReason) continue;
    const mediaId = artifact.mediaId?.trim().toLowerCase() ?? "";
    annotations.push({
      matchLineageKey: artifactLineageKey,
      coachNote: artifact.coachNote?.trim(),
      ...(mediaId ? { mediaId } : {}),
      ...(artifact.durationMs !== undefined ? { durationMs: artifact.durationMs } : {}),
      ...(artifact.mimeType?.trim() ? { mimeType: artifact.mimeType.trim() } : {}),
    });
  }

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_to_overlay_annotations_complete",
    sharedAthleteId,
    sharedCompetitionId,
    artifactCount: input.artifactSet.artifacts.length,
    overlayCount: annotations.length,
    lineageKeys: annotations.map((a) => a.matchLineageKey),
    slotKeys: annotations.map((a) => slotKeyFromLineageKey(a.matchLineageKey)),
  });

  return annotations;
}

export function mergeCoachBreakdownIntoMatches(input: {
  matches: readonly CompetitionDetailMatchSnapshot[];
  overlayAnnotations: readonly CompetitionMatchOverlayAnnotation[];
  sharedAthleteId: string;
  sharedCompetitionId: string;
}): CompetitionDetailMatchSnapshot[] {
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "parent_merge_begin",
    sharedAthleteId: input.sharedAthleteId || null,
    sharedCompetitionId: input.sharedCompetitionId || null,
    matchLineageKey: input.overlayAnnotations[0]?.matchLineageKey ?? null,
    overlayCount: input.overlayAnnotations.length,
    matchCount: input.matches.length,
    artifacts: input.overlayAnnotations.map((annotation) => ({
      sharedAthleteId: input.sharedAthleteId || null,
      sharedCompetitionId: input.sharedCompetitionId || null,
      matchLineageKey: annotation.matchLineageKey,
      hasCoachNote: Boolean(annotation.coachNote?.trim()),
    })),
  });
  const overlaysByLineageKey = new Map<string, CompetitionMatchOverlayAnnotation>();
  for (const annotation of input.overlayAnnotations) {
    const key = annotation.matchLineageKey.trim();
    if (key && annotation.coachNote?.trim()) overlaysByLineageKey.set(key, annotation);
  }

  let mergeCount = 0;
  const matches = input.matches.map((match) => {
    const matchId = match.id.trim();
    const overlay = overlaysByLineageKey.get(matchId);
    const exactLineageMatch = Boolean(overlay);
    const hasCoachNote = Boolean(overlay?.coachNote?.trim());
    let skipReason: string | null = null;
    if (!overlay) skipReason = "no_overlay_for_match_id";
    else if (!hasCoachNote) skipReason = "overlay_missing_coach_note";

    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: skipReason ? "parent_merge_match_skip" : "parent_merge_match_attempt",
      sharedAthleteId: input.sharedAthleteId || null,
      sharedCompetitionId: input.sharedCompetitionId || null,
      matchLineageKey: overlay?.matchLineageKey ?? matchId,
      slotKey: slotKeyFromLineageKey(overlay?.matchLineageKey ?? matchId),
      overlayCount: input.overlayAnnotations.length,
      matchId,
      artifactMatchLineageKey: overlay?.matchLineageKey ?? null,
      exactLineageMatch,
      hasCoachNote,
      reason: skipReason,
      availableOverlayLineageKeys: [...overlaysByLineageKey.keys()],
    });
    const coachNote = overlay?.coachNote?.trim();
    if (!overlay || !coachNote) return match;
    mergeCount += 1;
    const mergedMediaId = overlay.mediaId?.trim() || null;
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "parent_merge_match_success",
      sharedAthleteId: input.sharedAthleteId || null,
      sharedCompetitionId: input.sharedCompetitionId || null,
      matchLineageKey: overlay.matchLineageKey,
      slotKey: slotKeyFromLineageKey(overlay.matchLineageKey),
      overlayCount: input.overlayAnnotations.length,
      matchId,
      artifactMatchLineageKey: overlay.matchLineageKey,
      hasMediaId: Boolean(mergedMediaId),
    });
    logCoachMediaCorridorTrace("PARENT_MERGE", {
      // Parent merge has no coach-save corridor traceId; correlate via lineage keys.
      traceId: null,
      sharedAthleteId: input.sharedAthleteId || null,
      sharedCompetitionId: input.sharedCompetitionId || null,
      matchLineageKey: overlay.matchLineageKey,
      hasMediaId: Boolean(mergedMediaId),
      mediaId: mergedMediaId,
    });
    return {
      ...match,
      coachNote,
      ...(mergedMediaId ? { mediaId: mergedMediaId } : {}),
      ...(overlay.durationMs !== undefined ? { durationMs: overlay.durationMs } : {}),
      ...(overlay.mimeType?.trim() ? { mimeType: overlay.mimeType.trim() } : {}),
    };
  });

  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "parent_overlay_merge_complete",
    sharedAthleteId: input.sharedAthleteId || null,
    sharedCompetitionId: input.sharedCompetitionId || null,
    artifactCount: overlaysByLineageKey.size,
    mergeCount,
    parentRenderCount: matches.filter((match) => (match.coachNote ?? "").trim().length > 0).length,
    lineageIds: matches.map((match) => match.id),
  });

  const targetLineageKey =
    input.overlayAnnotations
      .find((annotation) => Boolean(annotation.coachNote?.trim()))
      ?.matchLineageKey.trim() ??
    input.matches[0]?.id.trim() ??
    "";
  const targetMergedMatch = matches.find((match) => match.id.trim() === targetLineageKey);
  const outputCoachNoteLength = (targetMergedMatch?.coachNote ?? "").trim().length;
  let b7SkipReason: string | null = null;
  if (input.overlayAnnotations.length === 0) {
    b7SkipReason = "no_annotations";
  } else if (!overlaysByLineageKey.has(targetLineageKey)) {
    b7SkipReason = "no_overlay_for_match_id";
  } else if (outputCoachNoteLength === 0) {
    b7SkipReason = "overlay_missing_coach_note";
  }
  logMatchBreakdownBoundaryProbe({
    probeId: "B7",
    outcome: mergeCount >= 1 && outputCoachNoteLength > 0 ? "pass" : "fail",
    deviceRole: "parent",
    traceId: null,
    sharedAthleteId: input.sharedAthleteId.trim() || null,
    sharedCompetitionId: input.sharedCompetitionId.trim() || null,
    matchLineageKey: targetLineageKey || null,
    overlayAnnotationCount: input.overlayAnnotations.length,
    mergeCount,
    outputCoachNoteLength,
    skipReason: b7SkipReason,
  });

  return matches;
}
