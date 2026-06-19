import { buildAthleteAuthoritySnapshot } from "../identity/buildAthleteAuthoritySnapshot";
import type { AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { DeviceRole } from "../storage/deviceRoleStore";

import type { AuthoritySnapshot } from "./authoritySnapshotContract";
import { projectAuthoritySnapshot } from "./projectAuthoritySnapshot";

export type CaptureAuthoritySnapshotOptions = {
  deviceRole: DeviceRole | null;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  skipCoachWriterSessionRefresh?: boolean;
  /** Test hook — defaults to `new Date().toISOString()`. */
  capturedAt?: string;
};

/**
 * Generates a production-safe Authority Snapshot from repository authority truth.
 * Delegates resolution to `buildAthleteAuthoritySnapshot`; does not fork authority logic.
 */
export async function captureAuthoritySnapshot(
  options: CaptureAuthoritySnapshotOptions,
): Promise<AuthoritySnapshot> {
  const snap = await buildAthleteAuthoritySnapshot({
    parentRole: options.deviceRole,
    observability: {
      sourceTrigger: options.sourceTrigger,
      role: options.deviceRole,
    },
    skipCoachWriterSessionRefresh: options.skipCoachWriterSessionRefresh === true,
  });

  return projectAuthoritySnapshot(snap, {
    deviceRole: options.deviceRole,
    capturedAt: options.capturedAt,
    sourceTrigger: options.sourceTrigger,
  });
}
