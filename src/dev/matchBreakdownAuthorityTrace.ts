/** Searchable prefix for match breakdown authority forensic logs (__DEV__ client only). */
export const MATCH_BREAKDOWN_AUTHORITY_TRACE_PREFIX =
  "[MATCH_BREAKDOWN_AUTHORITY_TRACE]";

export function inviteTokenSuffix(
  token: string | null | undefined,
): string | null {
  const normalized = token?.trim() ?? "";
  if (!normalized) return null;
  return normalized.slice(-6);
}

export type MatchBreakdownAuthorityTraceFields = {
  traceId?: string | null;
  sharedAthleteId?: string | null;
  sharedCompetitionId?: string | null;
  matchLineageKey?: string | null;
  generation?: number | null;
  inviteTokenSuffix?: string | null;
  [key: string]: unknown;
};

/** One-line structured JSON log for authority lifecycle tracing. */
export function logMatchBreakdownAuthorityTrace(
  stage: string,
  fields: MatchBreakdownAuthorityTraceFields,
): void {
  if (!__DEV__) return;
  console.log(
    MATCH_BREAKDOWN_AUTHORITY_TRACE_PREFIX,
    JSON.stringify({
      stage,
      timestamp: new Date().toISOString(),
      traceId: fields.traceId ?? null,
      sharedAthleteId: fields.sharedAthleteId ?? null,
      sharedCompetitionId: fields.sharedCompetitionId ?? null,
      matchLineageKey: fields.matchLineageKey ?? null,
      generation:
        fields.generation === undefined ? null : (fields.generation ?? null),
      inviteTokenSuffix: fields.inviteTokenSuffix ?? null,
      ...fields,
    }),
  );
}
