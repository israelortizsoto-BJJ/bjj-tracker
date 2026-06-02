/**
 * TEMP DEV: competition mutation lifecycle tracing for persistence vs optimistic divergence.
 * Remove after debug completes.
 */

export type CompMutationOperationKind = "optimistic" | "local" | "server" | "canonical";

export type CompMutationLogFields = {
  competitionId?: string | null;
  athleteId?: string | null;
  sharedAthleteId?: string | null;
  lineageKey?: string | null;
  overlayCount?: number | null;
  localStoreAffected?: string | null;
  canonicalPayloadIds?: readonly string[] | null;
  operationKind?: CompMutationOperationKind | null;
  surface?: string | null;
  phaseDetail?: string | null;
  error?: string | null;
  [key: string]: unknown;
};

const CORE_KEYS = new Set([
  "competitionId",
  "athleteId",
  "sharedAthleteId",
  "lineageKey",
  "overlayCount",
  "localStoreAffected",
  "canonicalPayloadIds",
  "operationKind",
  "surface",
  "phaseDetail",
  "error",
]);

function buildPayload(fields: CompMutationLogFields): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!CORE_KEYS.has(key)) extra[key] = value;
  }
  return {
    competitionId: fields.competitionId ?? null,
    athleteId: fields.athleteId ?? null,
    sharedAthleteId: fields.sharedAthleteId ?? null,
    lineageKey: fields.lineageKey ?? null,
    overlayCount: fields.overlayCount ?? null,
    localStoreAffected: fields.localStoreAffected ?? null,
    canonicalPayloadIds: fields.canonicalPayloadIds ?? null,
    operationKind: fields.operationKind ?? null,
    surface: fields.surface ?? null,
    phaseDetail: fields.phaseDetail ?? null,
    error: fields.error ?? null,
    ...extra,
  };
}

export type CompMutationPhase = "BEGIN" | "LOCAL" | "PUBLISH" | "RECONCILE" | "COMPLETE" | "ERROR";

export function logCompSave(phase: CompMutationPhase, fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log(`[COMP_SAVE_${phase}]`, buildPayload(fields));
}

export function logCompDelete(phase: CompMutationPhase, fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log(`[COMP_DELETE_${phase}]`, buildPayload(fields));
}

export function logCompCacheInvalidation(fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log("[COMP_CACHE_INVALIDATION]", buildPayload(fields));
}

export function logCompHydrateReplayAfterDelete(fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log("[COMP_HYDRATE_REPLAY_AFTER_DELETE]", buildPayload(fields));
}

export function logCompPublishGuard(fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log("[COMP_PUBLISH_GUARD]", buildPayload(fields));
}

export function logCompOverlayMaterialize(fields: CompMutationLogFields): void {
  if (!__DEV__) return;
  console.log("[COMP_OVERLAY_MATERIALIZE]", buildPayload(fields));
}
