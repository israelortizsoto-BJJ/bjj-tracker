import type { CompetitionTrainingSkillFocus } from "../ai-coach/competitionTrainingSkillFocus";
import { recommendedFocusAreaFromTrainingSkillFocus } from "../ai-coach/competitionTrainingSkillFocus";
import { logAthleteLineageTrace } from "../identity/athleteLineageTrace";
import { getCanonicalKidForSharedAthleteId } from "../identity/canonicalSharedAthleteOwner";
import type { KidsById } from "../types/coachKid";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedSharedAthlete,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";

/** Athlete weekly note plus optional derived training emphasis (never overwrites coach copy). */
export type ResolvedSyncedWeeklyDoc = SyncedWeeklyMessagePayload & {
  recommendedFocusArea?: string;
};

export type ResolveWeeklyDocSession = Pick<CoachWeeklySyncSessionResponse, "weekly"> & {
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null> | null;
};

export type ParentWeeklySessionSnapshot = ResolveWeeklyDocSession & {
  /** From GET /sessions; used to validate roster kid `sharedAthleteId` against the same GET payload. */
  athletes?: SyncedSharedAthlete[] | null;
};

/**
 * Deterministic weekly scope: kid row `sharedAthleteId` from storage (`loadedKidsById`) must appear
 * on the session GET roster (`sessionAthletes`). Same invite/session plane as `weeklySessionSnapshot`.
 */
export function sharedAthleteIdFromRosterForSession(
  rosterKidId: string | null,
  kidRowSharedAthleteId: string | null | undefined,
  sessionAthletes: SyncedSharedAthlete[] | null | undefined,
): string | null {
  const kidId = typeof rosterKidId === "string" ? rosterKidId.trim() : "";
  if (!kidId) return null;
  const raw = typeof kidRowSharedAthleteId === "string" ? kidRowSharedAthleteId.trim() : "";
  if (!raw) return null;
  const roster = Array.isArray(sessionAthletes) ? sessionAthletes : [];
  const ids = new Set(
    roster
      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
      .filter((id) => id.length > 0),
  );
  return ids.has(raw) ? raw : null;
}

/**
 * When there is no roster `Kid` row yet, the parent device athlete id (`pa_*`) may still match
 * `session.athletes` after the athlete is added to the worker session.
 */
export function sharedAthleteIdFromParentAthleteForSession(
  parentAthleteId: string | null | undefined,
  sessionAthletes: SyncedSharedAthlete[] | null | undefined,
): string | null {
  const raw = typeof parentAthleteId === "string" ? parentAthleteId.trim() : "";
  if (!raw) return null;
  const roster = Array.isArray(sessionAthletes) ? sessionAthletes : [];
  const ids = new Set(
    roster
      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
      .filter((id) => id.length > 0),
  );
  return ids.has(raw) ? raw : null;
}

/**
 * Parent Summary / This Week: resolve `sharedAthleteId` for `weeklyByAthleteId` lookup.
 * When the session roster is missing or empty (common on older cache rows), still use the parent
 * athlete id so `weeklyByAthleteId[pa_*]` resolves — matches strict This Week behavior.
 */
export function resolveWeeklySharedAthleteIdForParentSnapshot(
  parentAthleteId: string | null | undefined,
  kidsById: KidsById | null | undefined,
  session: ParentWeeklySessionSnapshot | null | undefined,
): string | null {
  const aid = typeof parentAthleteId === "string" ? parentAthleteId.trim() : "";
  if (!aid || !session) return null;

  let candidate: string | null = null;

  const linkedKid =
    kidsById && aid ? getCanonicalKidForSharedAthleteId(kidsById, aid) : null;

  if (linkedKid) {
    candidate = sharedAthleteIdFromRosterForSession(
      linkedKid.id,
      linkedKid.sharedAthleteId,
      session.athletes,
    );
  }
  if (!candidate) {
    candidate = sharedAthleteIdFromParentAthleteForSession(aid, session.athletes);
  }

  const roster = session.athletes;
  const rosterEmpty = !Array.isArray(roster) || roster.length === 0;
  if (!candidate && rosterEmpty && aid) {
    candidate = aid;
  }

  return candidate;
}

function isValidWeeklyDoc(v: unknown): v is SyncedWeeklyMessagePayload {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

function weeklyByAthleteMapHasValidDoc(
  map: ResolveWeeklyDocSession["weeklyByAthleteId"],
): boolean {
  if (!map || typeof map !== "object" || Array.isArray(map)) return false;
  for (const v of Object.values(map)) {
    if (v != null && isValidWeeklyDoc(v)) return true;
  }
  return false;
}

/**
 * Resolves the weekly doc for a parent view using athlete scope when available.
 * Per-athlete `weeklyByAthleteId[id]` wins when present and valid. Invite-level `weekly` is used only
 * when the resolved athlete id has **no** map entry (legacy invite data), and **only if** there is no
 * valid per-athlete weekly anywhere in `weeklyByAthleteId` (avoids stale invite when athlete-scoped
 * data exists). If the map **has** the id but the slot is null or structurally invalid, returns null
 * — no silent invite fallback.
 * When `trainingSkillFocus` is present, merges `recommendedFocusArea` onto the resolved doc — augments coach copy only.
 * Never throws.
 */
export function resolveWeeklyDoc(
  session: ResolveWeeklyDocSession,
  sharedAthleteId: string | null | undefined,
  trainingSkillFocus?: CompetitionTrainingSkillFocus | null,
): ResolvedSyncedWeeklyDoc | null {
  try {
    const id = typeof sharedAthleteId === "string" ? sharedAthleteId.trim() : "";

    const map = session.weeklyByAthleteId;
    const mapKeys = map && typeof map === "object" && !Array.isArray(map) ? Object.keys(map) : [];

    if (__DEV__) {
      console.log("[WEEKLY RESOLVE TRACE]", {
        resolvedAthleteId: id || null,
        weeklyByAthleteIdKeys: mapKeys,
        inviteSystemKey: session?.weekly?.systemKey ?? null,
        inviteHeadline: session?.weekly?.headline?.slice(0, 40) ?? null,
      });
    }

    if (__DEV__ && id) {
      const devMap = session?.weeklyByAthleteId ?? {};

      console.log("[WEEKLY PIPELINE TRACE]", {
        athleteId: id,
        hasAthleteDoc: !!devMap[id],
        mission: devMap[id]?.missionResourceUrl ?? null,
        available: Object.keys(devMap),
      });

      if (!(id in devMap)) {
        console.log("[weekly-doc-missing-athlete]", {
          requested: id,
          available: Object.keys(devMap),
        });
      } else if (devMap[id] == null) {
        console.warn("[ATHLETE DOC EMPTY]", {
          sharedAthleteId: id,
        });
      }
    }

    if (id && map && typeof map === "object" && !Array.isArray(map)) {
      if (Object.prototype.hasOwnProperty.call(map, id)) {
        const athleteDoc = map[id];
        if (athleteDoc != null && isValidWeeklyDoc(athleteDoc)) {
          const recommendedFocusArea = recommendedFocusAreaFromTrainingSkillFocus(
            trainingSkillFocus ?? null,
          );
          logAthleteLineageTrace({
            operation: "hydrate",
            source: "weekly_resolve",
            sharedAthleteId: id,
            route: "resolveWeeklyDoc.weeklyByAthleteId",
            extra: {
              weekStartYMD: athleteDoc.weekStartYMD,
              headline: athleteDoc.headline?.slice(0, 80) ?? null,
            },
          });
          if (__DEV__) {
            console.log("[AUTHORITY_CHAIN_TRACE]", {
              stage: "5_resolve_weekly_doc",
              selectedWeeklySource: "weeklyByAthleteId",
              resolvedAthleteId: id,
              headline: athleteDoc.headline?.slice(0, 120) ?? null,
              systemKey: athleteDoc.systemKey ?? null,
              weekStartYMD: athleteDoc.weekStartYMD ?? null,
              fallbackReason: null,
            });
            console.log("[SYSTEMKEY TRACE SUMMARY]", {
              traceStage: "9_resolveWeeklyDoc_result",
              headline: athleteDoc.headline?.slice(0, 120) ?? null,
              systemKey: athleteDoc.systemKey ?? null,
              athleteId: id || null,
              weekStartYMD: athleteDoc.weekStartYMD ?? null,
              keyExistsOnObject: Object.prototype.hasOwnProperty.call(athleteDoc, "systemKey"),
              selectedWeeklySource: "weeklyByAthleteId",
              source: "resolveWeeklyDoc",
            });
            console.log("[WEEKLY RESOLVE TRACE]", {
              selectedWeeklySource: "weeklyByAthleteId",
              selectedSystemKey: athleteDoc.systemKey ?? null,
              fallbackReason: null,
            });
          }
          if (recommendedFocusArea) {
            return { ...athleteDoc, recommendedFocusArea };
          }
          return athleteDoc;
        }
        if (__DEV__) {
          console.log("[AUTHORITY_CHAIN_TRACE]", {
            stage: "5_resolve_weekly_doc",
            selectedWeeklySource: null,
            resolvedAthleteId: id,
            headline: null,
            systemKey: null,
            fallbackReason: "athlete_slot_present_not_usable_no_invite",
            slotRawHeadline:
              athleteDoc != null &&
              typeof athleteDoc === "object" &&
              "headline" in athleteDoc
                ? String((athleteDoc as { headline?: unknown }).headline ?? "").slice(0, 120)
                : null,
            slotPassesIsValidWeeklyDoc: athleteDoc != null && isValidWeeklyDoc(athleteDoc),
          });
          console.log("[WEEKLY RESOLVE TRACE]", {
            selectedWeeklySource: null,
            selectedSystemKey: null,
            fallbackReason: "athlete_slot_present_not_usable_no_invite",
          });
        }
        return null;
      }
    }

    const mapHasValidAthleteDoc = weeklyByAthleteMapHasValidDoc(map);
    const inviteWeekly = session?.weekly;
    if (
      id &&
      inviteWeekly != null &&
      isValidWeeklyDoc(inviteWeekly) &&
      !mapHasValidAthleteDoc
    ) {
      logAthleteLineageTrace({
        operation: "fallback_projection",
        source: "weekly_resolve",
        sharedAthleteId: id,
        route: "resolveWeeklyDoc.invite_weekly",
        extra: {
          fallbackReason: "no_athlete_weekly_key_legacy_invite",
          weekStartYMD: inviteWeekly.weekStartYMD,
        },
      });
      if (__DEV__) {
        console.log("[SYSTEMKEY TRACE SUMMARY]", {
          traceStage: "9_resolveWeeklyDoc_result",
          headline: inviteWeekly.headline?.slice(0, 120) ?? null,
          systemKey: inviteWeekly.systemKey ?? null,
          athleteId: id || null,
          weekStartYMD: inviteWeekly.weekStartYMD ?? null,
          keyExistsOnObject: Object.prototype.hasOwnProperty.call(inviteWeekly, "systemKey"),
          selectedWeeklySource: "invite_weekly",
          source: "resolveWeeklyDoc",
        });
        console.log("[WEEKLY RESOLVE TRACE]", {
          selectedWeeklySource: "invite_weekly",
          selectedSystemKey: inviteWeekly.systemKey ?? null,
          fallbackReason: "no_athlete_weekly_key_legacy_invite",
        });
      }
      const recommendedFocusArea = recommendedFocusAreaFromTrainingSkillFocus(
        trainingSkillFocus ?? null,
      );
      if (recommendedFocusArea) {
        return { ...inviteWeekly, recommendedFocusArea };
      }
      return inviteWeekly;
    }

    if (__DEV__) {
      const skippedInviteDueToAthleteMap =
        Boolean(id) &&
        inviteWeekly != null &&
        isValidWeeklyDoc(inviteWeekly) &&
        mapHasValidAthleteDoc;
      console.log("[WEEKLY RESOLVE TRACE]", {
        selectedWeeklySource: null,
        selectedSystemKey: null,
        fallbackReason: !id
          ? "no_resolved_shared_athlete_id"
          : skippedInviteDueToAthleteMap
            ? "invite_skipped_per_athlete_map_present"
            : "no_usable_weekly_doc",
      });
    }

    return null;
  } catch {
    return null;
  }
}

/** True if any per-athlete slot or invite-level `weekly` has a valid weekly doc. */
export function sessionSnapshotHasUsableWeeklyDoc(
  session: ResolveWeeklyDocSession | null | undefined,
): boolean {
  if (!session) return false;
  const m = session.weeklyByAthleteId;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    for (const v of Object.values(m)) {
      if (v != null && isValidWeeklyDoc(v)) return true;
    }
  }
  const w = session.weekly;
  return w != null && isValidWeeklyDoc(w);
}
