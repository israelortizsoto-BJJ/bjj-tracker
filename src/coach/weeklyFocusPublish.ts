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
 * Publishes optional `missionResourceUrl` (Mission card) and `familyResourceUrl` (Study the move) independently.
 */
export function kidWeeklyFocusToPublishPayload(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
): CoachWeeklySyncPublishBody {
  console.log("[PAYLOAD INPUT ENTRY]", {
    mission: entry.familyResourceUrl,
    family: entry.familyResourceUrl,
  });

  const headline = entry.title.trim().slice(0, 200);
  const bodyRaw =
    entry.focusType === "template"
      ? (entry.metadata ?? "").trim()
      : (entry.note ?? "").trim();
  const body =
    bodyRaw ||
    "Your coach highlighted this week’s focus in class. Use the title above as the main cue, and ask your coach if you want more detail.";

  const publishedMissionUrl = normalizeFamilyResourceUrl(entry.familyResourceUrl);
  const publishedMissionLabel = publishedMissionUrl
    ? normalizePublishedLabel(entry.familyResourceLabel) ??
      defaultFamilyLinkButtonLabel(publishedMissionUrl)
    : undefined;
  console.log("[MISSION DEBUG FIX]", {
    rawMission: entry.familyResourceUrl,
    publishedMissionUrl,
  });
  const publishedFamilyUrl = normalizeFamilyResourceUrl(entry.familyResourceUrl);
  const publishedFamilyLabel = publishedFamilyUrl
    ? normalizePublishedLabel(entry.familyResourceLabel) ??
      defaultFamilyLinkButtonLabel(publishedFamilyUrl)
    : undefined;
  const familyCoachRecapNote = normalizePublishedCoachRecap(entry.familyCoachRecapNote);

  console.log("[PAYLOAD FINAL]", {
    mission: publishedMissionUrl,
    family: publishedFamilyUrl,
  });

  console.log("[PAYLOAD LINKS]", {
    mission: publishedMissionUrl,
    study: publishedFamilyUrl,
  });

  if (__DEV__) {
    const rawMission = (entry.familyResourceUrl ?? "").trim();
    const rawFam = (entry.familyResourceUrl ?? "").trim();
    const rawRecap = (entry.familyCoachRecapNote ?? "").trim();
    console.log("[bjj-weekly-publish-payload]", {
      storedMissionResourceUrl: rawMission || null,
      publishedMissionResourceUrl: publishedMissionUrl ?? null,
      storedFamilyResourceUrl: rawFam || null,
      storedFamilyResourceLabel: (entry.familyResourceLabel ?? "").trim() || null,
      publishedFamilyResourceUrl: publishedFamilyUrl ?? null,
      publishedFamilyResourceLabel: publishedFamilyLabel ?? null,
      storedFamilyCoachRecapNoteLen: rawRecap.length,
      publishedFamilyCoachRecapNoteSentAsEmptyString: (familyCoachRecapNote ?? "") === "",
      publishedFamilyCoachRecapNoteLen: (familyCoachRecapNote ?? "").length,
    });
  }

  return {
    weekStartYMD,
    headline,
    body: body.slice(0, 8000),
    missionResourceUrl: publishedMissionUrl ?? null,
    missionResourceLabel: publishedMissionLabel ?? null,
    familyResourceUrl: publishedFamilyUrl ?? null,
    familyResourceLabel: publishedFamilyLabel ?? null,
    // Always send so JSON includes the key; empty string clears on the worker. Omitting the key
    // previously caused the worker to replace `weekly` without this field and drop stored recaps.
    familyCoachRecapNote: familyCoachRecapNote ?? "",
  };
}
