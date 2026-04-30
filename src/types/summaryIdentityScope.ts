/**
 * Identity + summary builder state is keyed by athlete scope:
 * child rows use `KidId`; account-level Training (no kid on sessions) uses `__account__`.
 * Stored under profile JSON (`bjj.profile.v2`) as `summaryIdentityByScope`.
 */

export const SUMMARY_IDENTITY_ACCOUNT_SCOPE = "__account__" as const;

/** `KidId` or {@link SUMMARY_IDENTITY_ACCOUNT_SCOPE} */
export type SummaryIdentityScope = string;

export type SummaryIdentityScopeStored = {
  summaryIdentityInputs?: unknown;
  summaryIdentityMode?: unknown;
};

export type SummaryIdentityByScope = Record<string, SummaryIdentityScopeStored>;
