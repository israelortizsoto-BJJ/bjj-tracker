/**
 * Privacy-controlled scan-hook boundary (contract §9).
 *
 * Interface / typed placeholder only. No production implementation, no object
 * read, no scanning conclusion, no default approval. Human Product/Privacy Owner
 * owns policy decisions. Not wired into runtime by this skeleton.
 */

export const SCAN_HOOK_STATUSES = [
  "scan_not_required",
  "scan_required_and_passed",
  "scan_rejected",
  "scan_failed",
  "policy_unresolved",
] as const;

export type ScanHookStatus = (typeof SCAN_HOOK_STATUSES)[number];

export type PrivacyScanHookInput = {
  readonly verificationRecordId: string;
  readonly admissionKeyHash: string;
  readonly declaredMimeType?: string;
  readonly observedMimeType?: string;
  readonly policyIdentity: string;
  readonly timeoutBudgetMs: number;
};

export type PrivacyScanHookResult = {
  readonly status: ScanHookStatus;
  readonly policyIdentity: string;
  readonly opaqueProviderReference?: string;
};

/**
 * Unimplemented privacy scan hook. Calling it is a hard error so no implicit
 * approval path exists.
 */
export type PrivacyScanHook = {
  readonly evaluate: (input: PrivacyScanHookInput) => Promise<PrivacyScanHookResult>;
};

export function createUnimplementedPrivacyScanHook(): PrivacyScanHook {
  return {
    evaluate: async () => {
      throw new Error(
        "PrivacyScanHook is reserved for Human Product/Privacy Owner policy. " +
          "No production implementation exists; this skeleton must not approve, " +
          "scan, or read media objects.",
      );
    },
  };
}
