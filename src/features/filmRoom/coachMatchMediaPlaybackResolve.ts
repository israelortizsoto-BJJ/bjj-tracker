import type { CoachMatchMediaResolveResult } from "../../services/coachMatchMediaResolutionApi";
import type { CoachMatchMediaSessionTarget } from "../../services/resolveCoachMatchMediaSessionTarget";
import type { SyncedMatchMediaAttachmentProjection } from "../../types/coachWeeklySync";

/** Route/bridge identity only — never a signed URL, signature, secret, or object key. */
export type CoachMatchMediaPlaybackIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  matchMediaAssetId: string;
  expectedRevision: number;
};

export type CoachMatchMediaResolveAttemptResult =
  | {
      status: "ready";
      url: string;
      expiresAt: string;
      revision: number;
    }
  | { status: "removed" }
  | { status: "missing" }
  | {
      status: "unavailable";
      reason: "denial" | "network" | "no_session" | "identity";
      retryable: boolean;
      httpStatus: number | null;
    };

export type CoachMatchMediaPlaybackDependencies = {
  getAttachment(
    input: {
      sharedAthleteId: string;
      sharedCompetitionId: string;
      matchLineageKey: string;
    },
  ): Promise<SyncedMatchMediaAttachmentProjection | null>;
  resolveSessionTarget(): Promise<CoachMatchMediaSessionTarget | null>;
  resolveAttachment(input: {
    linkToken: string;
    coachWriterSecret: string;
    sharedAthleteId: string;
    sharedCompetitionId: string;
    matchLineageKey: string;
    matchMediaAssetId: string;
    expectedRevision?: number;
    apiBaseUrlOverride?: string | null;
  }): Promise<CoachMatchMediaResolveResult>;
  now(): number;
};

export function parseCoachMatchMediaPlaybackIdentity(input: {
  sharedAthleteId?: string | null;
  sharedCompetitionId?: string | null;
  matchLineageKey?: string | null;
  matchMediaAssetId?: string | null;
  expectedRevision?: string | number | null;
}): CoachMatchMediaPlaybackIdentity | null {
  const sharedAthleteId = input.sharedAthleteId?.trim() ?? "";
  const sharedCompetitionId = input.sharedCompetitionId?.trim() ?? "";
  const matchLineageKey = input.matchLineageKey?.trim() ?? "";
  const matchMediaAssetId = input.matchMediaAssetId?.trim() ?? "";
  const revisionRaw =
    typeof input.expectedRevision === "number"
      ? input.expectedRevision
      : Number.parseInt(String(input.expectedRevision ?? "").trim(), 10);
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    !matchLineageKey ||
    !matchMediaAssetId ||
    !Number.isSafeInteger(revisionRaw) ||
    revisionRaw < 1
  ) {
    return null;
  }
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId,
    expectedRevision: revisionRaw,
  };
}

export function isCoachMatchMediaUrlExpired(
  expiresAt: string,
  nowMs: number = Date.now(),
): boolean {
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return true;
  return nowMs >= expiresMs;
}

/** Player/content delivery failure kinds surfaced to the URL-lifecycle owner. */
export type CoachMatchMediaDeliveryFailureKind =
  | "expired"
  | "unauthorized"
  | "delivery";

/**
 * Decide the next URL-lifecycle step for a playback/content delivery failure.
 * At most one automatic re-resolution per playback identity; repeated callbacks
 * with no active URL are ignored so the player cannot loop resolve.
 */
export function decideCoachMatchMediaDeliveryFailure(input: {
  hasActiveUrl: boolean;
  autoReresolveUsed: boolean;
}): "ignore" | "auto_reresolve" | "unavailable" {
  if (!input.hasActiveUrl) return "ignore";
  if (!input.autoReresolveUsed) return "auto_reresolve";
  return "unavailable";
}

/**
 * Best-effort classify of expo-av error strings. HTTP status is not reliably
 * exposed; unknown errors fail safely as "delivery" (one auto re-resolve).
 */
export function classifyCoachMatchMediaPlayerDeliveryError(
  error: string,
): CoachMatchMediaDeliveryFailureKind {
  const text = error.trim().toLowerCase();
  if (!text) return "delivery";
  if (/\b401\b/.test(text) || text.includes("unauthorized")) return "unauthorized";
  if (/\b403\b/.test(text) || text.includes("expired") || text.includes("forbidden")) {
    return "expired";
  }
  return "delivery";
}

export function classifyCoachMatchMediaResolveError(error: unknown): {
  reason: "denial" | "network";
  retryable: boolean;
  httpStatus: number | null;
  allowAutoReresolve: boolean;
} {
  const httpStatus =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : null;
  const status =
    httpStatus !== null && Number.isFinite(httpStatus) ? httpStatus : null;
  if (status === 401) {
    return {
      reason: "denial",
      retryable: true,
      httpStatus: status,
      allowAutoReresolve: true,
    };
  }
  if (status !== null && status >= 400 && status < 500) {
    return {
      reason: "denial",
      retryable: true,
      httpStatus: status,
      allowAutoReresolve: false,
    };
  }
  return {
    reason: "network",
    retryable: true,
    httpStatus: status,
    allowAutoReresolve: false,
  };
}

/**
 * One-shot resolve against the current hydrated attachment row.
 * Does not mutate attachment storage. Returns memory-only URL fields.
 * Callers supply session/attachment/resolution dependencies (hook wires production defaults).
 */
export async function resolveCoachMatchMediaPlaybackOnce(
  identity: CoachMatchMediaPlaybackIdentity,
  dependencies: CoachMatchMediaPlaybackDependencies,
): Promise<CoachMatchMediaResolveAttemptResult> {
  const attachment = await dependencies.getAttachment({
    sharedAthleteId: identity.sharedAthleteId,
    sharedCompetitionId: identity.sharedCompetitionId,
    matchLineageKey: identity.matchLineageKey,
  });

  if (!attachment) {
    return { status: "missing" };
  }
  if (attachment.state === "tombstoned") {
    return { status: "removed" };
  }
  if (attachment.state !== "attached") {
    return { status: "missing" };
  }

  // Always resolve against the current hydrated row (supersedes stale route identity).
  const matchMediaAssetId = attachment.matchMediaAssetId.trim();
  const expectedRevision = attachment.revision;
  if (!matchMediaAssetId || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return {
      status: "unavailable",
      reason: "identity",
      retryable: false,
      httpStatus: null,
    };
  }

  const target = await dependencies.resolveSessionTarget();
  if (!target) {
    return {
      status: "unavailable",
      reason: "no_session",
      retryable: true,
      httpStatus: null,
    };
  }

  try {
    const resolved = await dependencies.resolveAttachment({
      apiBaseUrlOverride: target.apiBaseUrl,
      linkToken: target.linkToken,
      coachWriterSecret: target.coachWriterSecret,
      sharedAthleteId: identity.sharedAthleteId,
      sharedCompetitionId: identity.sharedCompetitionId,
      matchLineageKey: identity.matchLineageKey,
      matchMediaAssetId,
      expectedRevision,
    });
    const url = resolved.url.trim();
    const expiresAt = resolved.expiresAt.trim();
    if (!url || !expiresAt) {
      return {
        status: "unavailable",
        reason: "denial",
        retryable: true,
        httpStatus: null,
      };
    }
    if (isCoachMatchMediaUrlExpired(expiresAt, dependencies.now())) {
      return {
        status: "unavailable",
        reason: "denial",
        retryable: true,
        httpStatus: null,
      };
    }
    return {
      status: "ready",
      url,
      expiresAt,
      revision: resolved.revision,
    };
  } catch (error) {
    const classified = classifyCoachMatchMediaResolveError(error);
    return {
      status: "unavailable",
      reason: classified.reason,
      retryable: classified.retryable,
      httpStatus: classified.httpStatus,
    };
  }
}
