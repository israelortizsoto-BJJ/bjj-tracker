/**
 * Canonical invite-link token normalization for local matching (join, reconcile, roster,
 * publish, parent binding, revoke). Always use this instead of ad hoc trim/lowercase rules.
 */
export function normalizeInviteLinkToken(raw: string | undefined | null): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function inviteLinkTokenTail(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.length > 8 ? t.slice(-8) : t;
}
