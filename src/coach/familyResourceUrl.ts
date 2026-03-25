const MAX_FAMILY_URL = 500;

/**
 * When `URL` rejects (some real-world links still open in the system browser), allow a
 * narrow http(s) fallback so publish, sync, and in-app open behave consistently.
 */
function familyUrlFallbackAfterParseFailure(candidate: string): string | undefined {
  const head = candidate.slice(0, 24).toLowerCase();
  if (head.startsWith("javascript:") || head.startsWith("data:")) return undefined;
  if (!/^https?:\/\//i.test(candidate)) return undefined;
  if (/\s/.test(candidate)) return undefined;
  return candidate.length > MAX_FAMILY_URL ? candidate.slice(0, MAX_FAMILY_URL) : candidate;
}

/** Canonical family-facing URL for publish payloads and stored docs. */
export function normalizeFamilyResourceUrl(raw?: string | null): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  const candidate =
    t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    const s = u.toString();
    return s.length > MAX_FAMILY_URL ? s.slice(0, MAX_FAMILY_URL) : s;
  } catch {
    return familyUrlFallbackAfterParseFailure(candidate);
  }
}

/** Same normalization as publish; use before `Linking.openURL`. */
export function familyResourceUrlForLinking(raw?: string | null): string | null {
  const n = normalizeFamilyResourceUrl(raw);
  return n ?? null;
}

/**
 * Button / published label when the coach leaves the optional label blank.
 * Recognizes common YouTube and Instagram URL shapes (including youtu.be / instagr.am).
 */
export function defaultFamilyLinkButtonLabel(
  normalizedUrl: string,
  coachLabel?: string | null,
): string {
  const label = (coachLabel ?? "").trim();
  if (label) return label;
  const lower = normalizedUrl.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "Open on YouTube";
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "Open on Instagram";
  return "Open link";
}
