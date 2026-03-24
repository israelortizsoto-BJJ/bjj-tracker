import type { KidWeeklyFocusEntry } from "../types/coachKid";
import type { CoachWeeklySyncPublishBody } from "../types/coachWeeklySync";

const MAX_FAMILY_URL = 500;
const MAX_FAMILY_LABEL = 80;

/**
 * When `URL` rejects (some real-world links still open in the system browser), allow a
 * narrow http(s) fallback so publish matches what coaches see in the family-link field.
 */
function familyUrlFallbackAfterParseFailure(candidate: string): string | undefined {
  const head = candidate.slice(0, 24).toLowerCase();
  if (head.startsWith("javascript:") || head.startsWith("data:")) return undefined;
  if (!/^https?:\/\//i.test(candidate)) return undefined;
  if (/\s/.test(candidate)) return undefined;
  return candidate.length > MAX_FAMILY_URL ? candidate.slice(0, MAX_FAMILY_URL) : candidate;
}

function normalizePublishedUrl(raw?: string | null): string | undefined {
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

function normalizePublishedLabel(raw?: string | null): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return t.length > MAX_FAMILY_LABEL ? t.slice(0, MAX_FAMILY_LABEL) : t;
}

/**
 * Maps a saved weekly focus row to the **family-facing** remote document.
 * Does not include coach check-in notes, outcomes, or the coach-only reference video URL (`youtubeUrl`).
 */
export function kidWeeklyFocusToPublishPayload(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
): CoachWeeklySyncPublishBody {
  const headline = entry.title.trim().slice(0, 200);
  const bodyRaw =
    entry.focusType === "template"
      ? (entry.metadata ?? "").trim()
      : (entry.note ?? "").trim();
  const body =
    bodyRaw ||
    "Your coach highlighted this week’s focus in class. Use the title above as the main cue, and ask your coach if you want more detail.";

  const familyResourceUrl = normalizePublishedUrl(entry.familyResourceUrl);
  const familyResourceLabel = familyResourceUrl
    ? normalizePublishedLabel(entry.familyResourceLabel) ?? "Coach link"
    : undefined;

  if (__DEV__) {
    const rawFam = (entry.familyResourceUrl ?? "").trim();
    console.log("[bjj-weekly-publish-payload]", {
      storedFamilyResourceUrl: rawFam || null,
      storedFamilyResourceLabel: (entry.familyResourceLabel ?? "").trim() || null,
      publishedFamilyResourceUrl: familyResourceUrl ?? null,
      publishedFamilyResourceLabel: familyResourceLabel ?? null,
    });
  }

  return {
    weekStartYMD,
    headline,
    body: body.slice(0, 8000),
    ...(familyResourceUrl ? { familyResourceUrl, familyResourceLabel } : {}),
  };
}
