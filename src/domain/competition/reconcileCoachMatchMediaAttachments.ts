import {
  applyCoachMatchMediaAttachmentSet,
} from "../../storage/coachMatchMediaAttachmentStore";
import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedMatchMediaAttachmentProjectionSet,
} from "../../types/coachWeeklySync";

/** Minimal writer-session snapshot shape needed for Match media attachment hydrate. */
export type MatchMediaAttachmentWriterSnapshot = {
  linkTokenNorm: string;
  session?: CoachWeeklySyncSessionResponse;
  writerLinkUpdatedAt?: string;
  writerLinkCreatedAt?: string;
};

function sortWriterSessionSnapshotsNewestFirst(
  snaps: MatchMediaAttachmentWriterSnapshot[],
): MatchMediaAttachmentWriterSnapshot[] {
  return [...snaps].sort((a, b) => {
    const uA = a.writerLinkUpdatedAt ?? "";
    const uB = b.writerLinkUpdatedAt ?? "";
    const c = uB.localeCompare(uA);
    if (c !== 0) return c;
    const cA = a.writerLinkCreatedAt ?? "";
    const cB = b.writerLinkCreatedAt ?? "";
    return cB.localeCompare(cA);
  });
}

/**
 * Collect projection sets that are explicitly present for an athlete across sessions.
 * Field omission, empty maps, and missing athlete keys are intentionally skipped
 * (preserve local) — they are not authoritative empties.
 */
function collectPresentAttachmentSetsForAthlete(
  sessionsOrderedNewestFirst: readonly CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedMatchMediaAttachmentProjectionSet[] {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return [];
  const out: SyncedMatchMediaAttachmentProjectionSet[] = [];
  for (const session of sessionsOrderedNewestFirst) {
    if (!Object.prototype.hasOwnProperty.call(session, "matchMediaAttachmentsByAthleteId")) {
      continue;
    }
    const map = session.matchMediaAttachmentsByAthleteId;
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    if (!Object.prototype.hasOwnProperty.call(map, athleteId)) continue;
    const set = map[athleteId];
    if (!set) continue;
    if (set.sharedAthleteId.trim() !== athleteId) continue;
    out.push(set);
  }
  return out;
}

/**
 * Coach-only hydration of projected Match media attachment metadata from writer session GETs.
 * Runs after topology reconcile. Revision CAS lives in the store; absent matches are preserve.
 */
export async function reconcileCoachMatchMediaAttachments(opts: {
  successfulSnapshots: MatchMediaAttachmentWriterSnapshot[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  if (totalActiveWriterCount <= 0 || successfulSnapshots.length === 0) {
    logCoachMediaCorridorTrace("MATCH_MEDIA_RECONCILIATION_INPUT", {
      result: "preserved",
      reason: "no_successful_snapshots",
      totalActiveWriterCount,
      successfulSnapshotCount: successfulSnapshots.length,
    });
    return;
  }

  const withSession = successfulSnapshots.filter(
    (s): s is MatchMediaAttachmentWriterSnapshot & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) {
    logCoachMediaCorridorTrace("MATCH_MEDIA_RECONCILIATION_INPUT", {
      result: "preserved",
      reason: "no_session_payloads",
    });
    return;
  }

  const sessionsOrdered = sortWriterSessionSnapshotsNewestFirst(withSession)
    .map((s) => s.session)
    .filter((s): s is CoachWeeklySyncSessionResponse => Boolean(s));

  const athleteIds = [
    ...new Set(
      sessionsOrdered.flatMap((session) => {
        if (!Object.prototype.hasOwnProperty.call(session, "matchMediaAttachmentsByAthleteId")) {
          return [];
        }
        const map = session.matchMediaAttachmentsByAthleteId;
        if (!map || typeof map !== "object" || Array.isArray(map)) return [];
        return Object.keys(map)
          .map((id) => id.trim())
          .filter(Boolean);
      }),
    ),
  ];
  logCoachMediaCorridorTrace("MATCH_MEDIA_RECONCILIATION_INPUT", {
    result: athleteIds.length > 0 ? "present_sets" : "preserved",
    reason: athleteIds.length > 0 ? null : "projection_omitted_or_empty",
    successfulSessionCount: sessionsOrdered.length,
    projectedAthleteIds: athleteIds,
  });

  for (const sharedAthleteId of athleteIds) {
    const presentSets = collectPresentAttachmentSetsForAthlete(
      sessionsOrdered,
      sharedAthleteId,
    );
    for (const attachmentSet of presentSets) {
      // Empty attachment arrays still "present" but apply no row deletes (preserve).
      await applyCoachMatchMediaAttachmentSet(attachmentSet);
      logCoachMediaCorridorTrace("MATCH_MEDIA_RECONCILIATION_APPLIED", {
        sharedAthleteId: attachmentSet.sharedAthleteId,
        attachmentCount: attachmentSet.attachments.length,
        attachmentIdentities: attachmentSet.attachments.map((attachment) => ({
          sharedCompetitionId: attachment.sharedCompetitionId,
          matchLineageKey: attachment.matchLineageKey,
          state: attachment.state,
          revision: attachment.revision,
        })),
      });
    }
  }
}
