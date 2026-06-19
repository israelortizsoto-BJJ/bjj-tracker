import type { DeviceRole } from "../storage/deviceRoleStore";

/** Frozen Tier 1 Topology Snapshot contract version. */
export const TOPOLOGY_SNAPSHOT_CONTRACT_VERSION = "1" as const;

export const MAX_COMPETITIONS_PER_ATHLETE = 400;
export const MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION = 64;

export type TopologySnapshotCaptureMode = "coach_substrate_probe";

export type TopologyPeekOutcome = "hit" | "miss" | "memory_not_loaded" | "empty_athlete_id";

export type TopologyProjectionSource =
  | "topology_projection_used"
  | "fallback_missing_topology"
  | "fallback_cardinality_guard";

export type TopologySnapshotCompetition = {
  sharedCompetitionId: string;
  competitionLineageKey: string;
  updatedAt: string;
  matchCount: number;
  matchLineageKeys: string[];
  projectionSource: TopologyProjectionSource;
};

export type TopologySnapshotAthleteDomain = {
  sharedAthleteId: string;
  memoryLoaded: boolean;
  peekOutcome: TopologyPeekOutcome;
  peekArtifactUpdatedAt: string | null;
  diskPresent: boolean;
  diskArtifactUpdatedAt: string | null;
  peekCompetitionCount: number;
  peekMatchCount: number;
  diskCompetitionCount: number;
  diskMatchCount: number;
  competitions: TopologySnapshotCompetition[];
  schemaVersion?: 1;
  memoryDiskDiverged?: boolean;
};

/** Production-safe, redacted topology evidence for incident capture (Tier 1, coach only). */
export type TopologySnapshot = {
  contractVersion: typeof TOPOLOGY_SNAPSHOT_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: Extract<DeviceRole, "coach">;
  syncConfigured: boolean;
  captureMode: TopologySnapshotCaptureMode;
  athleteDomain: TopologySnapshotAthleteDomain;
  additionalAthleteDomains?: TopologySnapshotAthleteDomain[];
  visibleCompetitionIds?: string[];
  sourceTrigger?: string;
};
