/**
 * DEV-only identity mint observability (Build 33.2 audit).
 * Does not alter creation, binding, hydration, or authority resolution.
 */

export type IdentityMintEvent =
  | "mint"
  | "fallback_create"
  | "bind_existing"
  | "relink"
  | "duplicate_risk"
  | "duplicate_risk_blocked";

export type IdentityMintTracePayload = {
  sourceFlow: string;
  callerFunction: string;
  athleteName?: string | null;
  existingSharedId?: string | null;
  newlyMintedSharedId?: string | null;
  inviteToken?: string | null;
  linkedKidId?: string | null;
  localAthleteId?: string | null;
  idKind?: "shared_ath" | "pa_" | "kid_row" | "kid_shared_row" | "unknown";
  extra?: Record<string, unknown>;
};

const TAG_BY_EVENT: Record<IdentityMintEvent, string> = {
  mint: "[IDENTITY_MINT]",
  fallback_create: "[IDENTITY_FALLBACK_CREATE]",
  bind_existing: "[IDENTITY_BIND_EXISTING]",
  relink: "[IDENTITY_RELINK]",
  duplicate_risk: "[IDENTITY_DUPLICATE_RISK]",
  duplicate_risk_blocked: "[IDENTITY_DUPLICATE_RISK_BLOCKED]",
};

export function classifySharedIdKind(id: string | null | undefined): IdentityMintTracePayload["idKind"] {
  const t = (id ?? "").trim();
  if (!t) return undefined;
  if (t.startsWith("shared_ath_")) return "shared_ath";
  if (t.startsWith("pa_")) return "pa_";
  if (t.startsWith("kid_shared_")) return "kid_shared_row";
  if (t.startsWith("kid_")) return "kid_row";
  return "unknown";
}

export function logIdentityMintTrace(
  event: IdentityMintEvent,
  payload: IdentityMintTracePayload,
): void {
  if (!__DEV__) return;
  const tag = TAG_BY_EVENT[event];
  console.log(tag, {
    ...payload,
    idKind: payload.idKind ?? classifySharedIdKind(payload.newlyMintedSharedId ?? payload.existingSharedId),
    at: new Date().toISOString(),
  });
}
