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

function coachOutcomeForPublish(
  outcome: KidWeeklyFocusEntry["coachOutcome"],
): CoachWeeklySyncPublishBody["coachOutcome"] {
  switch (outcome) {
    case "not_yet":
      return "not_yet";
    case "developing":
      return "close";
    case "on_track":
      return "hit";
    default:
      return undefined;
  }
}

/**
 * Maps a saved weekly focus row to the **family-facing** remote document.
 * Does not include coach private notes or the coach-only reference video URL (`youtubeUrl`).
 * Publishes optional `missionResourceUrl` (Mission card) and `familyResourceUrl` (Study the move) independently.
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

  const publishedMissionUrl = normalizeFamilyResourceUrl(entry.missionResourceUrl);
  const publishedMissionLabel = publishedMissionUrl
    ? normalizePublishedLabel(entry.missionResourceLabel) ??
      defaultFamilyLinkButtonLabel(publishedMissionUrl)
    : undefined;
  const publishedFamilyUrl = normalizeFamilyResourceUrl(entry.familyResourceUrl);
  const publishedFamilyLabel = publishedFamilyUrl
    ? normalizePublishedLabel(entry.familyResourceLabel) ??
      defaultFamilyLinkButtonLabel(publishedFamilyUrl)
    : undefined;
  const familyCoachRecapNote = normalizePublishedCoachRecap(entry.familyCoachRecapNote);
  const coachOutcome = coachOutcomeForPublish(entry.coachOutcome);

  if (__DEV__) {
    const rawMission = (entry.missionResourceUrl ?? "").trim();
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
      publishedCoachOutcome: coachOutcome ?? null,
    });
  }

  const payload: CoachWeeklySyncPublishBody = {
    weekStartYMD,
    headline,
    body: body.slice(0, 8000),
    // Always send so JSON includes the key; empty string clears on the worker. Omitting the key
    // previously caused the worker to replace `weekly` without this field and drop stored recaps.
    familyCoachRecapNote: familyCoachRecapNote ?? "",
    ...(coachOutcome ? { coachOutcome } : {}),
  };

  // Omit link keys when there is nothing to publish so the worker keeps existing KV values
  // (non-destructive partial publish). JSON.stringify drops undefined — never assign undefined.
  if (publishedMissionUrl) {
    payload.missionResourceUrl = publishedMissionUrl;
    payload.missionResourceLabel = publishedMissionLabel ?? null;
  }
  if (publishedFamilyUrl) {
    payload.familyResourceUrl = publishedFamilyUrl;
    payload.familyResourceLabel = publishedFamilyLabel ?? null;
  }

  return payload;
}
