import { inviteLinkTokenTail } from "../coachShare/inviteLinkToken";
import type { DeviceRole } from "../storage/deviceRoleStore";
import type { CoachWeeklySyncSessionResponse } from "../types/coachWeeklySync";

import {
  WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
  type WorkerSessionAthleteDomain,
  type WorkerSessionAthletesUnionEntry,
  type WorkerSessionLinkEvidence,
  type WorkerSessionSnapshot,
  type WorkerSessionSnapshotSlice,
} from "./workerSessionSnapshotContract";

const MAX_COMPETITION_IDS_PER_ATHLETE = 400;
const MAX_BREAKDOWN_LINEAGE_KEYS = 64;
const MAX_FETCH_FAILURE_REASON_LENGTH = 280;

export type ProjectWorkerSessionLinkInput = {
  linkToken: string;
  fetchSuccess: boolean;
  fetchFailureReason?: string;
  httpStatus?: number | null;
  dataSource: "network" | "cache" | "none";
  sessionFetchedAt?: string;
  session?: CoachWeeklySyncSessionResponse | null;
};

export type ProjectWorkerSessionSnapshotContext = {
  deviceRole: DeviceRole | null;
  capturedAt?: string;
  syncConfigured: boolean;
};

export function sanitizeFetchFailureReason(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "fetch_failed";
  if (trimmed.length <= MAX_FETCH_FAILURE_REASON_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_FETCH_FAILURE_REASON_LENGTH)}…`;
}

function linkTokenTailForEvidence(linkToken: string): string {
  return inviteLinkTokenTail(linkToken) ?? "";
}

function sliceForDeviceRole(deviceRole: DeviceRole | null): WorkerSessionSnapshotSlice | undefined {
  if (deviceRole === "parent") return "parent";
  if (deviceRole === "coach") return "coach";
  return undefined;
}

function projectAthleteDomain(
  session: CoachWeeklySyncSessionResponse,
  sharedAthleteId: string,
): WorkerSessionAthleteDomain {
  const sid = sharedAthleteId.trim();
  const competitions = (session.competitions ?? []).filter((c) => c.sharedAthleteId.trim() === sid);
  const competitionIds = competitions
    .map((c) => c.id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPETITION_IDS_PER_ATHLETE);

  const weeklyByAthleteId = session.weeklyByAthleteId ?? {};
  const weeklyDoc = weeklyByAthleteId[sid] ?? null;
  const weeklyKeyPresent = Object.prototype.hasOwnProperty.call(weeklyByAthleteId, sid);

  const aggregate = session.competitionAggregateByAthleteId?.[sid];
  const topology = session.competitionTopologyByAthleteId?.[sid];
  const trainingProof = session.trainingProofByAthleteId?.[sid];
  const breakdown = session.coachMatchBreakdownArtifacts?.[sid];
  const breakdownArtifacts = breakdown?.artifacts ?? [];

  const topologyCompetitions = topology?.competitions ?? [];
  const topologyCompetitionCount = topology ? topologyCompetitions.length : undefined;
  const topologyMatchCount = topology
    ? topologyCompetitions.reduce((sum, competition) => sum + (competition.matches?.length ?? 0), 0)
    : undefined;

  const breakdownLineageKeys = [
    ...new Set(
      breakdownArtifacts
        .map((artifact) => artifact.matchLineageKey?.trim())
        .filter((key): key is string => Boolean(key)),
    ),
  ]
    .sort()
    .slice(0, MAX_BREAKDOWN_LINEAGE_KEYS);

  const athlete = session.athletes.find((row) => row.id.trim() === sid);
  const name = athlete?.name?.trim() || undefined;

  return {
    sharedAthleteId: sid,
    ...(name ? { name } : {}),
    competitionIds,
    competitionCount: competitionIds.length,
    weeklyKeyPresent,
    weeklyUpdatedAt: weeklyDoc?.updatedAt ?? null,
    aggregateUpdatedAt: aggregate?.updatedAt ?? null,
    topologyUpdatedAt: topology?.updatedAt ?? null,
    trainingProofUpdatedAt: trainingProof?.updatedAt ?? null,
    breakdownSetUpdatedAt: breakdown?.updatedAt ?? null,
    breakdownArtifactCount: breakdownArtifacts.length,
    ...(topologyCompetitionCount !== undefined ? { topologyCompetitionCount } : {}),
    ...(topologyMatchCount !== undefined ? { topologyMatchCount } : {}),
    ...(breakdownLineageKeys.length > 0 ? { breakdownLineageKeys } : {}),
    ...(aggregate?.totalMatches !== undefined ? { aggregateTotalMatches: aggregate.totalMatches } : {}),
  };
}

function projectLinkEvidence(input: ProjectWorkerSessionLinkInput): WorkerSessionLinkEvidence {
  const linkTokenTail = linkTokenTailForEvidence(input.linkToken);
  const base: WorkerSessionLinkEvidence = {
    linkTokenTail,
    fetchSuccess: input.fetchSuccess,
    dataSource: input.dataSource,
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
  };

  if (!input.fetchSuccess) {
    return {
      ...base,
      fetchFailureReason: sanitizeFetchFailureReason(input.fetchFailureReason ?? "fetch_failed"),
    };
  }

  const session = input.session;
  if (!session) {
    return {
      ...base,
      fetchSuccess: false,
      dataSource: "none",
      fetchFailureReason: "missing_session_payload",
    };
  }

  const athleteIds = session.athletes
    .map((athlete) => athlete.id.trim())
    .filter(Boolean);
  const athleteDomains = athleteIds.map((athleteId) => projectAthleteDomain(session, athleteId));

  return {
    ...base,
    sessionFetchedAt: input.sessionFetchedAt,
    athleteIds,
    athleteDomains,
    ...(session.schemaVersion !== undefined ? { schemaVersion: session.schemaVersion } : {}),
    competitionCountOnSession: Array.isArray(session.competitions) ? session.competitions.length : 0,
  };
}

function athletesUnionFromLinks(links: WorkerSessionLinkEvidence[]): WorkerSessionAthletesUnionEntry[] {
  const byId = new Map<string, string>();

  for (const link of links) {
    if (!link.fetchSuccess || !link.athleteDomains) continue;
    for (const domain of link.athleteDomains) {
      const sharedAthleteId = domain.sharedAthleteId.trim();
      if (!sharedAthleteId || byId.has(sharedAthleteId)) continue;
      const name = domain.name?.trim() || sharedAthleteId;
      byId.set(sharedAthleteId, name);
    }
  }

  return [...byId.entries()]
    .map(([sharedAthleteId, name]) => ({ sharedAthleteId, name }))
    .sort((a, b) => a.sharedAthleteId.localeCompare(b.sharedAthleteId));
}

function inviteLevelWeeklyUpdatedAtForLinks(
  linkInputs: ProjectWorkerSessionLinkInput[],
): string | null | undefined {
  if (linkInputs.length !== 1) return undefined;
  const only = linkInputs[0];
  if (!only.fetchSuccess || !only.session) return undefined;
  return only.session.weekly?.updatedAt ?? null;
}

/** Maps redacted worker session substrate to the frozen Tier 1 export contract. */
export function projectWorkerSessionSnapshot(
  linkInputs: ProjectWorkerSessionLinkInput[],
  ctx: ProjectWorkerSessionSnapshotContext,
): WorkerSessionSnapshot {
  const links = linkInputs.map(projectLinkEvidence);
  const sessionsFetchedOkCount = links.filter((link) => link.fetchSuccess).length;
  const activeLinkCount = links.length;
  const allSessionsFetched = activeLinkCount > 0 && sessionsFetchedOkCount === activeLinkCount;
  const athletesUnion = athletesUnionFromLinks(links);
  const slice = sliceForDeviceRole(ctx.deviceRole);
  const inviteLevelWeeklyUpdatedAt = inviteLevelWeeklyUpdatedAtForLinks(linkInputs);

  return {
    contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    deviceRole: ctx.deviceRole,
    syncConfigured: ctx.syncConfigured,
    captureMode: "get_only",
    activeLinkCount,
    sessionsFetchedOkCount,
    allSessionsFetched,
    links,
    ...(slice ? { slice } : {}),
    ...(athletesUnion.length > 0 ? { athletesUnion } : {}),
    ...(inviteLevelWeeklyUpdatedAt !== undefined ? { inviteLevelWeeklyUpdatedAt } : {}),
  };
}
