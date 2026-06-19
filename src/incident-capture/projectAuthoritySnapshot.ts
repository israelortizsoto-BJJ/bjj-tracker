import { linkedKidIdForParentAthlete } from "../identity/linkedKidIdForParentAthlete";
import type { AthleteAuthoritySnapshot, AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { DeviceRole } from "../storage/deviceRoleStore";

import {
  AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
  type AuthoritySnapshot,
  type AuthoritySnapshotRosterEntry,
} from "./authoritySnapshotContract";

export type ProjectAuthoritySnapshotContext = {
  deviceRole: DeviceRole | null;
  capturedAt?: string;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
};

function rosterEntriesFromSnapshot(snap: AthleteAuthoritySnapshot): AuthoritySnapshotRosterEntry[] {
  return snap.operatingAthleteRoster.map((athlete) => {
    const sharedAthleteId = athlete.id.trim();
    return {
      sharedAthleteId,
      name: athlete.name.trim(),
      kidId: linkedKidIdForParentAthlete(snap.loadedKids, sharedAthleteId),
    };
  });
}

function selectedAthleteDisplayName(
  snap: AthleteAuthoritySnapshot,
  resolvedOperatingAthleteId: string,
): string | undefined {
  if (!resolvedOperatingAthleteId) return undefined;
  const fromSorted = snap.sorted.find((a) => a.id.trim() === resolvedOperatingAthleteId);
  if (fromSorted?.name.trim()) return fromSorted.name.trim();
  const fromRoster = snap.operatingAthleteRoster.find(
    (a) => a.id.trim() === resolvedOperatingAthleteId,
  );
  const name = fromRoster?.name.trim();
  return name || undefined;
}

/** Maps internal authority substrate to the frozen Tier 1 export contract. */
export function projectAuthoritySnapshot(
  snap: AthleteAuthoritySnapshot,
  ctx: ProjectAuthoritySnapshotContext,
): AuthoritySnapshot {
  const resolvedOperatingAthleteId = snap.resolvedId.trim();
  const parentActiveAthleteId = snap.parentActiveAthleteId.trim();
  const sourceTrigger = ctx.sourceTrigger ?? snap.meta?.sourceTrigger;

  return {
    contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    deviceRole: ctx.deviceRole,
    resolvedOperatingAthleteId,
    parentActiveAthleteId,
    authorityBootstrapState: snap.authorityBootstrapState,
    coachSessionRefreshDegraded: snap.coachSessionRefreshDegraded,
    operatingAthleteRosterCount: snap.operatingAthleteRoster.length,
    linkedSharedAthleteIds: [...snap.linkedSharedAthleteIds],
    operatingAthleteRoster: rosterEntriesFromSnapshot(snap),
    selectedAthleteDisplayName: selectedAthleteDisplayName(snap, resolvedOperatingAthleteId),
    loadedKidCount: Object.keys(snap.loadedKids).length,
    ...(sourceTrigger ? { sourceTrigger } : {}),
  };
}
