import type { KidWeeklyFocusEntry } from "../types/coachKid";
import type { CoachWeeklySyncPublishBody } from "../types/coachWeeklySync";

import { defaultFamilyLinkButtonLabel, normalizeFamilyResourceUrl } from "./familyResourceUrl";

const MAX_FAMILY_LABEL = 80;
const MAX_FAMILY_COACH_RECAP = 2000;

function normalizePublishedLabel(raw?: string | null): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return t.length > MAX_FAMILY_LABEL ? t.slice(0, MAX_FAMILY_LABEL) : t;
}

function normalizePublishedCoachRecap(raw?: string | null): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return t.length > MAX_FAMILY_COACH_RECAP ? t.slice(0, MAX_FAMILY_COACH_RECAP) : t;
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

  const familyResourceUrl = normalizeFamilyResourceUrl(entry.familyResourceUrl);
  const familyResourceLabel = familyResourceUrl
    ? normalizePublishedLabel(entry.familyResourceLabel) ??
      defaultFamilyLinkButtonLabel(familyResourceUrl)
    : undefined;
  const familyCoachRecapNote = normalizePublishedCoachRecap(entry.familyCoachRecapNote);

  if (__DEV__) {
    const rawFam = (entry.familyResourceUrl ?? "").trim();
    const rawRecap = (entry.familyCoachRecapNote ?? "").trim();
    console.log("[bjj-weekly-publish-payload]", {
      storedFamilyResourceUrl: rawFam || null,
      storedFamilyResourceLabel: (entry.familyResourceLabel ?? "").trim() || null,
      publishedFamilyResourceUrl: familyResourceUrl ?? null,
      publishedFamilyResourceLabel: familyResourceLabel ?? null,
      storedFamilyCoachRecapNoteLen: rawRecap.length,
      publishedFamilyCoachRecapNoteSentAsEmptyString: (familyCoachRecapNote ?? "") === "",
      publishedFamilyCoachRecapNoteLen: (familyCoachRecapNote ?? "").length,
    });
  }

  return {
    weekStartYMD,
    headline,
    body: body.slice(0, 8000),
    ...(familyResourceUrl ? { familyResourceUrl, familyResourceLabel } : {}),
    // Always send so JSON includes the key; empty string clears on the worker. Omitting the key
    // previously caused the worker to replace `weekly` without this field and drop stored recaps.
    familyCoachRecapNote: familyCoachRecapNote ?? "",
  };
}
