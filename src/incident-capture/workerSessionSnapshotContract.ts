import type { DeviceRole } from "../storage/deviceRoleStore";

/** Frozen Tier 1 Worker Session Snapshot contract version. */
export const WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION = "1" as const;

export type WorkerSessionSnapshotCaptureMode = "get_only";

export type WorkerSessionSnapshotDataSource = "network" | "cache" | "none";

export type WorkerSessionSnapshotSlice = "parent" | "coach";

export type WorkerSessionAthleteDomain = {
  sharedAthleteId: string;
  competitionIds: string[];
  competitionCount: number;
  weeklyKeyPresent: boolean;
  weeklyUpdatedAt: string | null;
  aggregateUpdatedAt: string | null;
  topologyUpdatedAt: string | null;
  trainingProofUpdatedAt: string | null;
  breakdownSetUpdatedAt: string | null;
  breakdownArtifactCount: number;
  name?: string;
  topologyCompetitionCount?: number;
  topologyMatchCount?: number;
  breakdownLineageKeys?: string[];
  aggregateTotalMatches?: number;
};

export type WorkerSessionLinkEvidence = {
  linkTokenTail: string;
  fetchSuccess: boolean;
  fetchFailureReason?: string;
  httpStatus?: number | null;
  dataSource: WorkerSessionSnapshotDataSource;
  sessionFetchedAt?: string;
  athleteIds?: string[];
  athleteDomains?: WorkerSessionAthleteDomain[];
  schemaVersion?: number;
  competitionCountOnSession?: number;
};

export type WorkerSessionAthletesUnionEntry = {
  sharedAthleteId: string;
  name: string;
};

/** Production-safe, redacted worker session evidence for incident capture (Tier 1). */
export type WorkerSessionSnapshot = {
  contractVersion: typeof WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: DeviceRole | null;
  syncConfigured: boolean;
  captureMode: WorkerSessionSnapshotCaptureMode;
  activeLinkCount: number;
  sessionsFetchedOkCount: number;
  allSessionsFetched: boolean;
  links: WorkerSessionLinkEvidence[];
  slice?: WorkerSessionSnapshotSlice;
  athletesUnion?: WorkerSessionAthletesUnionEntry[];
  inviteLevelWeeklyUpdatedAt?: string | null;
};
