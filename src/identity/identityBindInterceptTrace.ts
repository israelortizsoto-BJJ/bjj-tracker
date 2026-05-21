/**
 * DEV-only pre-mint bind intercept observability (parent onboarding / add-athlete).
 */

export type IdentityBindInterceptEvent =
  | "invite_detected"
  | "intercept"
  | "canonical_resolved"
  | "projection_created"
  | "mint_blocked"
  | "fallback_mint_allowed";

const TAG_BY_EVENT: Record<IdentityBindInterceptEvent, string> = {
  invite_detected: "[IDENTITY_BIND_INVITE_DETECTED]",
  intercept: "[IDENTITY_BIND_INTERCEPT]",
  canonical_resolved: "[IDENTITY_BIND_CANONICAL_RESOLVED]",
  projection_created: "[IDENTITY_BIND_PROJECTION_CREATED]",
  mint_blocked: "[MINT_BLOCKED_EXISTING_CANONICAL]",
  fallback_mint_allowed: "[IDENTITY_BIND_FALLBACK_MINT_ALLOWED]",
};

export type IdentityBindInterceptTracePayload = {
  sourceFlow: string;
  callerFunction: string;
  athleteName?: string | null;
  inviteToken?: string | null;
  coachLinkId?: string | null;
  canonicalSharedAthleteId?: string | null;
  bindDecision?: string | null;
  bindSource?: string | null;
  sessionAthleteCount?: number;
  extra?: Record<string, unknown>;
};

export function logIdentityBindInterceptTrace(
  event: IdentityBindInterceptEvent,
  payload: IdentityBindInterceptTracePayload,
): void {
  if (!__DEV__) return;
  const tag = TAG_BY_EVENT[event];
  console.log(tag, {
    ...payload,
    at: new Date().toISOString(),
  });
}
