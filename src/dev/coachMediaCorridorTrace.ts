/**
 * Forensic structured trace for the Coach Media Corridor.
 * Logs only — never changes behavior.
 *
 * Primary correlation keys (always present on every stage):
 *   traceId, sharedAthleteId, sharedCompetitionId, matchLineageKey
 *
 * Coach save/publish stages share one `traceId`. Parent hydrate stages may
 * have `traceId: null`; correlate those via sharedAthleteId +
 * sharedCompetitionId + matchLineageKey (not mediaId — upload may fail).
 */
export const COACH_MEDIA_CORRIDOR_TRACE_PREFIX = "[COACH_MEDIA_CORRIDOR_TRACE]";

export type CoachMediaCorridorStage =
  | "UPLOAD_BEGIN"
  | "UPLOAD_SUCCESS"
  | "UPLOAD_FAILED"
  | "OVERLAY_UPDATED"
  | "ARTIFACT_BUILT"
  | "WORKER_PUT"
  | "WORKER_GET"
  | "PARENT_MERGE"
  | "MATCHCARD_RENDER";

export type CoachMediaCorridorTraceFields = {
  traceId?: string | null;
  sharedAthleteId?: string | null;
  sharedCompetitionId?: string | null;
  matchLineageKey?: string | null;
  voiceNoteId?: string | null;
  mediaId?: string | null;
  hasMediaId?: boolean;
  hasCoachNote?: boolean;
  durationMs?: number | null;
  mimeType?: string | null;
  error?: string | null;
  [key: string]: unknown;
};

/** One structured log line per corridor boundary crossing. */
export function logCoachMediaCorridorTrace(
  stage: CoachMediaCorridorStage,
  fields: CoachMediaCorridorTraceFields = {},
): void {
  const {
    traceId = null,
    sharedAthleteId = null,
    sharedCompetitionId = null,
    matchLineageKey = null,
    ...rest
  } = fields;
  console.log(COACH_MEDIA_CORRIDOR_TRACE_PREFIX, {
    stage,
    timestamp: new Date().toISOString(),
    traceId: traceId ?? null,
    sharedAthleteId: sharedAthleteId ?? null,
    sharedCompetitionId: sharedCompetitionId ?? null,
    matchLineageKey: matchLineageKey ?? null,
    ...rest,
  });
}
