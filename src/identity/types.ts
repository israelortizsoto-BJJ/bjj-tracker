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
  meta?: AthleteAuthoritySnapshotMeta;
};

export type BuildAthleteAuthoritySnapshotOptions = {
  parentRole: DeviceRole | null;
  observability?: AthleteAuthoritySnapshotMeta;
};
