/** Frozen Competition State Auditor Phase A contract version. */
export const COMPETITION_STATE_AUDITOR_CONTRACT_VERSION = "2" as const;

export const MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION = 64;

export const COMPETITION_STATE_AUDITOR_RING_MAX = 50;

export const COMPETITION_STATE_AUDITOR_RING_STORAGE_KEY =
  "mm:v1:competitionStateAuditorRing" as const;

export const MATMIND_TRANSITION_HEADER = "X-MatMind-Transition-Id" as const;

export const MATMIND_AUDIT_SNAPSHOT_HEADER = "X-MatMind-Audit-Snapshot" as const;

export type CompetitionStateSnapshotKind =
  | "parent_canonical"
  | "parent_publish"
  | "worker_persist"
  | "worker_get"
  | "coach_hydrated"
  | "coach_projection"
  | "summary_projection";

export type ParentPublishLane =
  | "shell_post"
  | "shell_put"
  | "shell_delete"
  | "aggregate_put"
  | "topology_put";

export type WorkerPersistLane = ParentPublishLane;

export type PublishOutcome = "ok" | "skipped" | "error";

export type CompetitionPerimeterRow = {
  sharedCompetitionId: string;
  entryId?: string;
  shellUpdatedAt?: string | null;
  matchCount: number;
  matchLineageKeys: string[];
  lineageFingerprint?: string;
  artifactUpdatedAt?: string | null;
  overlayCount?: number;
};

export type CompetitionDomainBlock = {
  competitionCount: number;
  totalMatchCount: number;
  sharedCompetitionIds: string[];
  detailPresentCount: number;
  perCompetition: CompetitionPerimeterRow[];
};

export type CompetitionStateSnapshotEnvelope = {
  contractVersion: typeof COMPETITION_STATE_AUDITOR_CONTRACT_VERSION;
  snapshotKind: CompetitionStateSnapshotKind;
  transitionId: string;
  parentTransitionId?: string;
  correlationId?: string;
  capturedAt: string;
  deviceRole: "parent" | "coach" | "worker";
  sharedAthleteId: string;
  linkTokenTail?: string;
  hydrationGeneration?: number;
};

export type ParentCanonicalSnapshot = CompetitionStateSnapshotEnvelope & {
  snapshotKind: "parent_canonical";
  deviceRole: "parent";
  generation: number;
  domain: CompetitionDomainBlock;
  localOnlyCompetitionIds: string[];
};

export type ParentPublishSnapshot = CompetitionStateSnapshotEnvelope & {
  snapshotKind: "parent_publish";
  deviceRole: "parent";
  publishLane: ParentPublishLane;
  publishOutcome: PublishOutcome;
  skipReason?: string;
  httpStatus?: number | null;
  generation?: string;
  domain: CompetitionDomainBlock;
  operationSharedCompetitionIds: string[];
};

export type WorkerPersistSnapshot = CompetitionStateSnapshotEnvelope & {
  snapshotKind: "worker_persist";
  deviceRole: "worker";
  persistLane: WorkerPersistLane;
  generation?: string;
  domain: CompetitionDomainBlock;
  beforeCompetitionCount: number;
  afterCompetitionCount: number;
  sessionCompetitionCount: number;
  rejectReason?: string;
};

export type CompetitionStateSnapshot =
  | ParentCanonicalSnapshot
  | ParentPublishSnapshot
  | WorkerPersistSnapshot;

export type CompetitionBoundaryLayer =
  | "parent_canonical→parent_publish"
  | "parent_publish→worker_persist";

export type CompetitionBoundaryDiff = {
  contractVersion: typeof COMPETITION_STATE_AUDITOR_CONTRACT_VERSION;
  comparedAt: string;
  layer: CompetitionBoundaryLayer;
  transitionId: string;
  sharedAthleteId: string;
  upstream: {
    snapshotKind: CompetitionStateSnapshotKind;
    transitionId: string;
    competitionCount: number;
    sharedCompetitionIds: string[];
  };
  downstream: {
    snapshotKind: CompetitionStateSnapshotKind;
    transitionId: string;
    competitionCount: number;
    sharedCompetitionIds: string[];
  };
  firstDivergence: {
    missingIds: string[];
    extraIds: string[];
    matchCountDeltas: {
      sharedCompetitionId: string;
      upstream: number;
      downstream: number;
    }[];
  } | null;
};

export type CompetitionAuditorTrailAnalysis = {
  contractVersion: typeof COMPETITION_STATE_AUDITOR_CONTRACT_VERSION;
  analyzedAt: string;
  sharedAthleteId: string;
  transitionId: string | null;
  parentCanonicalCount: number | null;
  parentPublishedCount: number | null;
  workerPersistedCount: number | null;
  parentContainedFive: boolean | null;
  parentPublishedFive: boolean | null;
  workerPersistedFive: boolean | null;
  firstDivergingBoundary: CompetitionBoundaryLayer | "none" | "insufficient_evidence";
  diffs: CompetitionBoundaryDiff[];
};

export type CompetitionStateAuditorRingRecord = {
  contractVersion: typeof COMPETITION_STATE_AUDITOR_CONTRACT_VERSION;
  updatedAt: string;
  snapshots: CompetitionStateSnapshot[];
};
