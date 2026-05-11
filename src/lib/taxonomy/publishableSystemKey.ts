/**
 * Canonical taxonomy id rules for coach publish → worker KV → Summary alignment.
 * Must stay aligned with `coach-sync-worker` `parseOptionalSystemKey`.
 */

export const PUBLISHABLE_SYSTEM_KEY_MAX_LEN = 160;

/** Same character class as worker `parseOptionalSystemKey` after trim + lowercase. */
export const PUBLISHABLE_SYSTEM_KEY_RE = /^[a-z0-9_.]+$/;

/**
 * Returns the canonical publishable id, or `undefined` if missing or invalid.
 * Lowercases deterministically so UI/store variants align with `[a-z0-9_.]+`.
 */
export function normalizePublishableSystemKey(raw: string | undefined | null): string | undefined {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || t.length > PUBLISHABLE_SYSTEM_KEY_MAX_LEN) return undefined;
  if (!PUBLISHABLE_SYSTEM_KEY_RE.test(t)) return undefined;
  return t;
}

export function isPublishableSystemKey(raw: string | undefined | null): boolean {
  return normalizePublishableSystemKey(raw) !== undefined;
}
