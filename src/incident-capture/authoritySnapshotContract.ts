import type { AthleteAuthorityBootstrapState, AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { DeviceRole } from "../storage/deviceRoleStore";

/** Frozen Tier 1 Authority Snapshot contract version. */
export const AUTHORITY_SNAPSHOT_CONTRACT_VERSION = "1" as const;

export type AuthoritySnapshotRosterEntry = {
  sharedAthleteId: string;
  name: string;
  kidId: string | null;
};

/** Production-safe, redacted authority evidence for incident capture (Tier 1). */
export type AuthoritySnapshot = {
  contractVersion: typeof AUTHORITY_SNAPSHOT_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: DeviceRole | null;
  resolvedOperatingAthleteId: string;
  parentActiveAthleteId: string;
  authorityBootstrapState: AthleteAuthorityBootstrapState;
  coachSessionRefreshDegraded: boolean;
  operatingAthleteRosterCount: number;
  linkedSharedAthleteIds: string[];
  operatingAthleteRoster?: AuthoritySnapshotRosterEntry[];
  selectedAthleteDisplayName?: string;
  loadedKidCount?: number;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
};
