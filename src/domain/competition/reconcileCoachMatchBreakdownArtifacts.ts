import {
  getCoachMatchBreakdownArtifactSet,
  peekCoachMatchBreakdownArtifactSet,
} from "../../storage/coachMatchBreakdownArtifactStore";
import type { WriterSessionSnapshotOk } from "../../storage/coachKidStore";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedCoachMatchBreakdownArtifactSet,
} from "../../types/coachWeeklySync";

function slotKeyFromLineageKey(matchLineageKey: string): string | null {
  const trimmed = matchLineageKey.trim();
  const slotMatch = /-slot-(\d+)$/.exec(trimmed);
  return slotMatch ? `slot-${slotMatch[1]}` : null;
}

function artifactSetSummary(artifactSet: SyncedCoachMatchBreakdownArtifactSet | null) {
  if (!artifactSet) {
    return {
      artifactCount: 0,
      updatedAt: null as string | null,
      lineageKeys: [] as string[],
      slotKeys: [] as (string | null)[],
      competitionIds: [] as string[],
      artifacts: [] as {
        sharedCompetitionId: string;
        matchLineageKey: string;
        slotKey: string | null;
        hasCoachNote: boolean;
      }[],
    };
  }
  return {
    artifactCount: artifactSet.artifacts.length,
    updatedAt: artifactSet.updatedAt,
    lineageKeys: artifactSet.artifacts.map((a) => a.matchLineageKey.trim()),
    slotKeys: artifactSet.artifacts.map((a) => slotKeyFromLineageKey(a.matchLineageKey)),
    competitionIds: [
      ...new Set(artifactSet.artifacts.map((a) => a.sharedCompetitionId.trim()).filter(Boolean)),
    ],
    artifacts: artifactSet.artifacts.map((a) => ({
      sharedCompetitionId: a.sharedCompetitionId.trim(),
      matchLineageKey: a.matchLineageKey.trim(),
      slotKey: slotKeyFromLineageKey(a.matchLineageKey),
      hasCoachNote: Boolean(a.coachNote?.trim()),
    })),
  };
}

function pickRemoteCoachMatchBreakdownArtifactSetForAthlete(
  sessionsOrdered: readonly CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedCoachMatchBreakdownArtifactSet | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  for (const session of sessionsOrdered) {
    const artifactSet = session.coachMatchBreakdownArtifacts?.[athleteId] ?? null;
    if (
      artifactSet &&
      artifactSet.sharedAthleteId.trim() === athleteId &&
      artifactSet.artifacts.length > 0
    ) {
      return artifactSet;
    }
  }
  return null;
}

/**
 * Evidence-only reconcile lane: hydrates coach match breakdown artifacts from writer session GETs
 * (newest-wins per athlete) with full lifecycle trace. No competition rows or UI side effects.
 */
export async function reconcileCoachMatchBreakdownArtifacts(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_reconcile_begin",
    totalActiveWriterCount,
    successfulSnapshotCount: successfulSnapshots.length,
  });

  if (totalActiveWriterCount <= 0 || successfulSnapshots.length === 0) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_reconcile_skip",
      reason:
        totalActiveWriterCount <= 0
          ? "totalActiveWriterCount<=0"
          : "no_successful_snapshots",
      totalActiveWriterCount,
      successfulSnapshotCount: successfulSnapshots.length,
    });
    return;
  }

  const withSession = successfulSnapshots.filter(
    (s): s is WriterSessionSnapshotOk & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_reconcile_skip",
      reason: "no_snapshots_with_session_payload",
      successfulSnapshotCount: successfulSnapshots.length,
    });
    return;
  }

  const sessionsOrdered = withSession
    .slice()
    .sort((a, b) => {
      const aTs = a.writerLinkUpdatedAt ?? a.writerLinkCreatedAt ?? "";
      const bTs = b.writerLinkUpdatedAt ?? b.writerLinkCreatedAt ?? "";
      return bTs.localeCompare(aTs);
    })
    .map((s) => s.session)
    .filter((s): s is CoachWeeklySyncSessionResponse => Boolean(s));

  const remoteAthleteIds = [
    ...new Set(
      sessionsOrdered.flatMap((session) =>
        session.athletes.map((a) => a.id.trim()).filter(Boolean),
      ),
    ),
  ];

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_reconcile_sessions_ordered",
    sessionCount: sessionsOrdered.length,
    remoteAthleteIds,
    sessionArtifactCounts: sessionsOrdered.map((session) => ({
      artifactSetCount: Object.keys(session.coachMatchBreakdownArtifacts ?? {}).length,
      artifactCount: Object.values(session.coachMatchBreakdownArtifacts ?? {}).reduce(
        (sum, set) => sum + set.artifacts.length,
        0,
      ),
    })),
  });

  for (const sharedAthleteId of remoteAthleteIds) {
    const remoteArtifactSet = pickRemoteCoachMatchBreakdownArtifactSetForAthlete(
      sessionsOrdered,
      sharedAthleteId,
    );
    const storeBeforePeek = peekCoachMatchBreakdownArtifactSet(sharedAthleteId);
    const storeBefore = await getCoachMatchBreakdownArtifactSet(sharedAthleteId);

    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_reconcile_athlete_compare",
      sharedAthleteId,
      remote: artifactSetSummary(remoteArtifactSet),
      storeBeforePeek: artifactSetSummary(storeBeforePeek),
      storeBeforeRead: artifactSetSummary(storeBefore),
      memoryMatchesDisk:
        (storeBeforePeek?.updatedAt ?? null) === (storeBefore?.updatedAt ?? null) &&
        (storeBeforePeek?.artifacts.length ?? 0) === (storeBefore?.artifacts.length ?? 0),
    });

    if (!remoteArtifactSet) {
      console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
        stage: "artifact_reconcile_athlete_skip",
        sharedAthleteId,
        reason: "no_remote_artifact_set_in_sessions",
      });
      continue;
    }

    const wouldSkipStale =
      Boolean(storeBefore) &&
      remoteArtifactSet.updatedAt.localeCompare(storeBefore!.updatedAt) < 0;
    const storeMatchesRemote =
      (storeBefore?.updatedAt ?? null) === remoteArtifactSet.updatedAt &&
      (storeBefore?.artifacts.length ?? 0) === remoteArtifactSet.artifacts.length;

    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_reconcile_athlete_compare_result",
      sharedAthleteId,
      incomingUpdatedAt: remoteArtifactSet.updatedAt,
      existingUpdatedAt: storeBefore?.updatedAt ?? null,
      wouldSkipStale,
      storeMatchesRemote,
      overlayCount: remoteArtifactSet.artifacts.length,
      lineageKeys: remoteArtifactSet.artifacts.map((a) => a.matchLineageKey.trim()),
      slotKeys: remoteArtifactSet.artifacts.map((a) => slotKeyFromLineageKey(a.matchLineageKey)),
      competitionIds: [
        ...new Set(
          remoteArtifactSet.artifacts.map((a) => a.sharedCompetitionId.trim()).filter(Boolean),
        ),
      ],
      reconcileGap:
        storeMatchesRemote
          ? null
          : wouldSkipStale
            ? "store_newer_than_remote"
            : storeBefore
              ? "store_out_of_sync_with_remote"
              : "store_missing_remote_artifacts",
    });

    const storeAfterPeek = peekCoachMatchBreakdownArtifactSet(sharedAthleteId);
    const storeAfter = await getCoachMatchBreakdownArtifactSet(sharedAthleteId);

    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_reconcile_athlete_post_read",
      sharedAthleteId,
      remote: artifactSetSummary(remoteArtifactSet),
      storeAfterPeek: artifactSetSummary(storeAfterPeek),
      storeAfterRead: artifactSetSummary(storeAfter),
      storeMatchesRemoteAfterRead:
        (storeAfter?.updatedAt ?? null) === remoteArtifactSet.updatedAt &&
        (storeAfter?.artifacts.length ?? 0) === remoteArtifactSet.artifacts.length,
    });
  }

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_reconcile_complete",
    athleteCount: remoteAthleteIds.length,
    successfulSnapshotCount: successfulSnapshots.length,
  });
}
