import type { ParentAthlete } from "../storage/athleteStore";
import type { KidsById } from "../types/coachKid";
import type { DeviceRole } from "../storage/deviceRoleStore";

export type AthleteAuthorityBootstrapState =
  | "ready"
  | "empty"
  | "coach_unresolved"
  | "coach_disconnected"
  | "parent_unresolved";

export type AuthoritySnapshotSourceTrigger =
  | "focus_effect"
  | "active_athlete_store_subscription"
  | "soft_refresh"
  | "coach_sync_hydration"
  | string;

export type AthleteAuthoritySnapshotMeta = {
  snapshotGeneration?: number;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  role?: DeviceRole | null;
};

export type AthleteAuthoritySnapshot = {
  sorted: ParentAthlete[];
  operatingAthleteRoster: ParentAthlete[];
  resolvedId: string;
  loadedKids: KidsById;
  authorityBootstrapState: AthleteAuthorityBootstrapState;
  coachOperatingAthleteChoices: ParentAthlete[];
  /** Persisted `StorageKeys.parentActiveAthleteId` at snapshot read time (pre-resolution). */
  parentActiveAthleteId: string;
  coachSessionRefreshDegraded: boolean;
  linkedSharedAthleteIds: string[];
  meta?: AthleteAuthoritySnapshotMeta;
};

export type BuildAthleteAuthoritySnapshotOptions = {
  parentRole: DeviceRole | null;
  observability?: AthleteAuthoritySnapshotMeta;
  /**
   * When true, read authority from local storage only. Used when coach sync reconcile
   * already ran (e.g. `bumpCoachSyncHydrationVersion`) to avoid refresh→bump loops.
   */
  skipCoachWriterSessionRefresh?: boolean;
};
