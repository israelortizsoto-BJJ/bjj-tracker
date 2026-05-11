import type { KidWeeklyFocusEntry } from "../types/coachKid";
import type { CoachWeeklySyncPublishBody } from "../types/coachWeeklySync";

import { normalizePublishableSystemKey } from "../lib/taxonomy/publishableSystemKey";
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

/** Newest-created row strictly before `entry` in the same week that still has a mission URL. */
function missionFieldsFromOlderSameWeekRow(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
  candidates: KidWeeklyFocusEntry[],
): Pick<KidWeeklyFocusEntry, "missionResourceUrl" | "missionResourceLabel"> | null {
  const older = candidates.filter(
    (e) =>
      e.kidId === entry.kidId &&
      e.weekStartYMD === weekStartYMD &&
      e.id !== entry.id &&
      e.createdAt.localeCompare(entry.createdAt) < 0,
  );
  older.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const e of older) {
    const u = (e.missionResourceUrl ?? "").trim();
    if (u) return { missionResourceUrl: e.missionResourceUrl, missionResourceLabel: e.missionResourceLabel };
  }
  return null;
}

/**
 * When the publish row lost `systemKey` but an older same-week row for the same template kept it
 * (e.g. partial coach updates), reuse that taxonomy id. Custom rows are not inferred from siblings.
 */
function systemKeyFromSameWeekEntriesFallback(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
  candidates: KidWeeklyFocusEntry[] | undefined,
): string | undefined {
  if (!candidates?.length || entry.focusType !== "template") return undefined;
  const pool = candidates.filter(
    (e) =>
      e.kidId === entry.kidId &&
      e.weekStartYMD === weekStartYMD &&
      e.id !== entry.id &&
      e.focusType === "template" &&
      e.templateId === entry.templateId &&
      normalizePublishableSystemKey(e.systemKey),
  );
  if (!pool.length) return undefined;
  pool.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return normalizePublishableSystemKey(pool[0]?.systemKey);
}

export type KidWeeklyFocusPublishPayloadOptions = {
  /**
   * Any rows for this Monday week; used to recover mission fields when the latest row omitted them
   * (e.g. check-in append), and to recover `systemKey` on the published row when it was stripped
   * locally but an older same-week row for the same template still has it.
   */
  sameWeekEntriesForMissionFallback?: KidWeeklyFocusEntry[];
};

/**
 * Maps a saved weekly focus row to the **family-facing** remote document.
 * Does not include coach private notes or the coach-only reference video URL (`youtubeUrl`).
 * Publishes optional `missionResourceUrl` (Mission card) and `familyResourceUrl` (Study the move) independently.
 */
export function kidWeeklyFocusToPublishPayload(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
  options?: KidWeeklyFocusPublishPayloadOptions,
): CoachWeeklySyncPublishBody {
  if (__DEV__) {
    console.log("[weekly-publish-mission-debug]", {
      selectedRowCreatedAt: entry.createdAt,
      hasMission: Boolean((entry.missionResourceUrl ?? "").trim()),
      focusType: entry.focusType,
    });
  }

  const headline = entry.title.trim().slice(0, 200);
  const systemKeyFromEntry = normalizePublishableSystemKey(entry.systemKey);
  const systemKeyFromWeekFallback = systemKeyFromSameWeekEntriesFallback(
    entry,
    weekStartYMD,
    options?.sameWeekEntriesForMissionFallback,
  );
  const systemKey = systemKeyFromEntry ?? systemKeyFromWeekFallback;
  const bodyRaw =
    entry.focusType === "template"
      ? (entry.metadata ?? "").trim()
      : (entry.note ?? "").trim();
  const body =
    bodyRaw ||
    "Your coach highlighted this week’s focus in class. Use the title above as the main cue, and ask your coach if you want more detail.";

  const entryMissionTrim = (entry.missionResourceUrl ?? "").trim();
  const missionFallback =
    !entryMissionTrim && options?.sameWeekEntriesForMissionFallback?.length
      ? missionFieldsFromOlderSameWeekRow(
          entry,
          weekStartYMD,
          options.sameWeekEntriesForMissionFallback,
        )
      : null;
  const missionResourceUrlForPublish = entryMissionTrim
    ? entry.missionResourceUrl
    : (missionFallback?.missionResourceUrl ?? entry.missionResourceUrl);
  const missionResourceLabelForPublish =
    entryMissionTrim
      ? entry.missionResourceLabel
      : (missionFallback?.missionResourceLabel ?? entry.missionResourceLabel);

  const publishedMissionUrl = normalizeFamilyResourceUrl(missionResourceUrlForPublish);
  const publishedMissionLabel = publishedMissionUrl
    ? normalizePublishedLabel(missionResourceLabelForPublish) ??
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
      publishPayloadSystemKey: systemKey ?? null,
      publishPayloadSystemKeySource: systemKeyFromEntry
        ? "entry"
        : systemKeyFromWeekFallback
          ? "same_week_template_fallback"
          : null,
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
    ...(systemKey ? { systemKey } : {}),
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

  if (__DEV__) {
    const rawSk = entry.systemKey;
    const trimmedRaw = typeof rawSk === "string" ? rawSk.trim() : "";
    const publishNormalizerRemoved =
      Boolean(trimmedRaw) && systemKey === undefined;
    console.log("[SYSTEMKEY TRACE CLIENT]", {
      traceStage: "1_local_publish_payload",
      headline: headline.slice(0, 120),
      systemKey: systemKey ?? null,
      athleteId: null,
      weekStartYMD,
      keyExistsOnPayload: Object.prototype.hasOwnProperty.call(payload, "systemKey"),
      keyValidAfterClientNormalize: Boolean(systemKey),
      clientPublishNormalizerRemovedKey: publishNormalizerRemoved,
      workerParserRemoved: null,
      source: "kidWeeklyFocusToPublishPayload_return",
      rawEntrySystemKey: typeof rawSk === "string" ? rawSk : null,
      systemKeyFromEntry: systemKeyFromEntry ?? null,
      systemKeyFromWeekFallback: systemKeyFromWeekFallback ?? null,
    });
  }

  return payload;
}
