/**
 * Independent hard interlock for Coach Match Breakdown schema-v2 publication.
 *
 * Enabled only when COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_ENABLED === "1".
 * Must not derive from or repurpose any SHARED_MATCH_MEDIA_* capability.
 */

import type { CoachMatchBreakdownArtifactSet } from "./coachMatchBreakdownArtifacts.ts";

export type CoachMatchBreakdownArtifactSetView = CoachMatchBreakdownArtifactSet;

export const COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_CODE =
  "coach_match_breakdown_schema_v2_publication_disabled" as const;

export const COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_ERROR =
  "Coach Match Breakdown schema v2 publication is disabled" as const;

export const COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_BLOCKED_FORENSIC_STAGE =
  "worker_coach_overlay_reject_schema_v2_publication_disabled" as const;

/** Exact-string "1" only. Undefined, "0", "true", "01", and every other value block v2. */
export function isCoachMatchBreakdownSchemaV2PublicationEnabled(
  value: string | undefined,
): boolean {
  return value === "1";
}

export function coachMatchBreakdownSchemaV2PublicationDisabledBody(): {
  error: typeof COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_ERROR;
  code: typeof COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_CODE;
} {
  return {
    error: COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_ERROR,
    code: COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_DISABLED_CODE,
  };
}

export function buildCoachMatchBreakdownSchemaV2PublicationDisabledResponse(): Response {
  return Response.json(coachMatchBreakdownSchemaV2PublicationDisabledBody(), {
    status: 409,
  });
}

/** Forensic event for blocked v2 — no secrets, tokens, payloads, notes, or media bytes. */
export function logCoachMatchBreakdownSchemaV2PublicationBlocked(fields: {
  traceId: string | null;
  tokenSuffix: string;
  sharedAthleteId: string;
  artifactCount: number;
  updatedAt: string;
}): void {
  console.log("[OVERLAY_FORENSIC]", {
    stage: COACH_MATCH_BREAKDOWN_SCHEMA_V2_PUBLICATION_BLOCKED_FORENSIC_STAGE,
    timestamp: new Date().toISOString(),
    sourceFile: "coach-sync-worker/src/coachMatchBreakdownSchemaV2Publication.ts",
    traceId: fields.traceId,
    tokenSuffix: fields.tokenSuffix,
    sharedAthleteId: fields.sharedAthleteId,
    schemaVersion: 2,
    artifactCount: fields.artifactCount,
    updatedAt: fields.updatedAt,
  });
}

export type CoachMatchBreakdownPutSessionView<TArtifactSet extends CoachMatchBreakdownArtifactSetView> = {
  writerSecret: string;
  athletes: ReadonlyArray<{ id: string }>;
  coachMatchBreakdownArtifacts: Record<string, TArtifactSet>;
};

export type CoachMatchBreakdownPutDecision<TArtifactSet extends CoachMatchBreakdownArtifactSetView> =
  | { kind: "unauthorized" }
  | { kind: "athlete_scope_denied" }
  | { kind: "schema_v2_publication_disabled" }
  | { kind: "stale" }
  | { kind: "equal_timestamp_conflict" }
  | {
      kind: "accept";
      nextCoachMatchBreakdownArtifacts: Record<string, TArtifactSet>;
    };

/**
 * Post-parse PUT policy:
 * writer auth → athlete scope → schema-v2 publication interlock →
 * stale/equal-timestamp → accept (caller performs KV write).
 */
export function decideCoachMatchBreakdownPut<
  TArtifactSet extends CoachMatchBreakdownArtifactSetView,
>(input: {
  capability: string | undefined;
  providedSecret: string;
  artifactSet: TArtifactSet;
  session: CoachMatchBreakdownPutSessionView<TArtifactSet>;
}): CoachMatchBreakdownPutDecision<TArtifactSet> {
  if (!input.providedSecret || input.session.writerSecret !== input.providedSecret) {
    return { kind: "unauthorized" };
  }
  if (
    !input.session.athletes.some(
      (athlete) => athlete.id.trim() === input.artifactSet.sharedAthleteId,
    )
  ) {
    return { kind: "athlete_scope_denied" };
  }
  if (
    input.artifactSet.schemaVersion === 2 &&
    !isCoachMatchBreakdownSchemaV2PublicationEnabled(input.capability)
  ) {
    return { kind: "schema_v2_publication_disabled" };
  }

  const existing =
    input.session.coachMatchBreakdownArtifacts[input.artifactSet.sharedAthleteId];
  if (existing && input.artifactSet.updatedAt.localeCompare(existing.updatedAt) < 0) {
    return { kind: "stale" };
  }
  if (
    existing &&
    input.artifactSet.updatedAt === existing.updatedAt &&
    JSON.stringify(input.artifactSet) !== JSON.stringify(existing)
  ) {
    return { kind: "equal_timestamp_conflict" };
  }

  return {
    kind: "accept",
    nextCoachMatchBreakdownArtifacts: {
      ...(input.session.coachMatchBreakdownArtifacts || {}),
      [input.artifactSet.sharedAthleteId]: input.artifactSet,
    },
  };
}
