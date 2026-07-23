/**
 * Fail-closed Production Verification canary gate.
 *
 * Server-controlled identity only. Request bodies never supply or override the
 * configured canary pair. Empty, partial, malformed, or mismatched configuration
 * bypasses verification without writes or media inspection.
 */

import { ADMISSION_FIELD_SEPARATOR } from "../../../shared-match-media-production-verification/src/admissionIdentity.ts";

export type CanaryGateBypassReason =
  | "flag_disabled"
  | "canary_asset_missing"
  | "canary_object_version_missing"
  | "canary_partial"
  | "canary_asset_malformed"
  | "canary_object_version_malformed"
  | "canary_asset_mismatch"
  | "canary_object_version_mismatch";

export type CanaryGateDecision =
  | {
      readonly allow: true;
      readonly outcome: "allow";
    }
  | {
      readonly allow: false;
      readonly outcome: "bypass";
      readonly reason: CanaryGateBypassReason;
    };

export type CanaryGateInput = {
  readonly enabled: boolean;
  /** Server-configured canary asset id (env). Never from the completion request. */
  readonly canaryAssetId: string | undefined;
  /** Server-configured canary object version (env). Never from the completion request. */
  readonly canaryObjectVersion: string | undefined;
  /** Completed-state matchMediaAssetId under evaluation. */
  readonly matchMediaAssetId: string;
  /** Immutable completed-state providerVersion under evaluation. */
  readonly providerVersion: string;
};

/**
 * Schema for canary identity fields: non-empty after trim, no unit separator.
 * Matches admission-field normalization rules without throwing into completion.
 */
export function isSchemaValidCanaryIdentityField(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed !== value) return false;
  if (trimmed.includes(ADMISSION_FIELD_SEPARATOR)) return false;
  return true;
}

function presentRaw(value: string | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * Evaluate whether Production Verification may proceed for this completion.
 * Fail-closed: any missing/malformed/partial/mismatched canary identity bypasses.
 */
export function evaluateProductionVerificationCanaryGate(
  input: CanaryGateInput,
): CanaryGateDecision {
  if (!input.enabled) {
    return { allow: false, outcome: "bypass", reason: "flag_disabled" };
  }

  const assetConfigured = presentRaw(input.canaryAssetId);
  const versionConfigured = presentRaw(input.canaryObjectVersion);

  if (!assetConfigured && !versionConfigured) {
    return { allow: false, outcome: "bypass", reason: "canary_asset_missing" };
  }
  if (assetConfigured !== versionConfigured) {
    return { allow: false, outcome: "bypass", reason: "canary_partial" };
  }

  const canaryAssetId = input.canaryAssetId as string;
  const canaryObjectVersion = input.canaryObjectVersion as string;

  if (!isSchemaValidCanaryIdentityField(canaryAssetId)) {
    return { allow: false, outcome: "bypass", reason: "canary_asset_malformed" };
  }
  if (!isSchemaValidCanaryIdentityField(canaryObjectVersion)) {
    return {
      allow: false,
      outcome: "bypass",
      reason: "canary_object_version_malformed",
    };
  }

  if (input.matchMediaAssetId !== canaryAssetId) {
    return { allow: false, outcome: "bypass", reason: "canary_asset_mismatch" };
  }
  if (input.providerVersion !== canaryObjectVersion) {
    return {
      allow: false,
      outcome: "bypass",
      reason: "canary_object_version_mismatch",
    };
  }

  return { allow: true, outcome: "allow" };
}
