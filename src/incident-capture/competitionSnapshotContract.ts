import type { DeviceRole } from "../storage/deviceRoleStore";

/** Frozen Tier 1 Competition Snapshot contract version. */
export const COMPETITION_SNAPSHOT_CONTRACT_VERSION = "1" as const;

export type CompetitionSnapshotFailureLayer =
  | "local_artifact_missing"
  | "annotation_rejected"
  | "merge_exact_id_mismatch"
  | "render_projection_missing"
  | "none_detected";

export type CompetitionSnapshotCompetition = {
  sharedCompetitionId: string;
  entryId: string;
  entryMatchCount: number;
  entryMatchIds: string[];
  localArtifactSetPresent: boolean;
  localArtifactCount: number;
  localArtifactLineageKeys: string[];
  annotationAcceptedCount: number;
  annotationAcceptedLineageKeys: string[];
  annotationRejectedCount: number;
  annotationRejectReasons: string[];
  mergeMatchedCount: number;
  mergeMatchedLineageKeys: string[];
  projectedCoachNoteCount: number;
  firstFailureLayer: CompetitionSnapshotFailureLayer;
};

/** Production-safe, redacted local competition attachment evidence. */
export type CompetitionSnapshot = {
  contractVersion: typeof COMPETITION_SNAPSHOT_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: Extract<DeviceRole, "parent" | "coach">;
  sharedAthleteId: string;
  visibleCompetitionCount: number;
  competitions: CompetitionSnapshotCompetition[];
};
