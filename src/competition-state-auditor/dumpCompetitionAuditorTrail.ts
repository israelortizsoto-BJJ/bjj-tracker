import { captureAuthoritySnapshot } from "../incident-capture/captureAuthoritySnapshot";
import { getDeviceRole } from "../storage/deviceRoleStore";

import {
  analyzeCompetitionAuditorSnapshots,
  formatCompetitionAuditorReadout,
} from "./analyzeCompetitionAuditorTrail";
import type { CompetitionAuditorTrailAnalysis } from "./competitionStateAuditorContract";
import type {
  ParentCanonicalSnapshot,
  ParentPublishSnapshot,
  WorkerPersistSnapshot,
} from "./competitionStateAuditorContract";
import { loadCompetitionStateAuditorRing } from "./competitionStateAuditorRing";
import { selectPhaseABoundarySnapshots } from "./selectPhaseABoundarySnapshots";

export type DumpCompetitionAuditorTrailOptions = {
  sharedAthleteId?: string;
  transitionId?: string;
  expectedCount?: number;
};

export type DumpCompetitionAuditorTrailResult = {
  sharedAthleteId: string | null;
  transitionId: string | null;
  analysis: CompetitionAuditorTrailAnalysis | null;
  snapshots: {
    s1: ParentCanonicalSnapshot | null;
    s2: ParentPublishSnapshot | null;
    s3: WorkerPersistSnapshot | null;
  };
  readout: string;
};

const DUMP_HEADER = "=== Competition State Auditor Phase A ===";

function printBoundarySnapshot(label: string, snapshot: unknown): void {
  console.log(label);
  if (snapshot) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log("(missing)");
  }
}

/**
 * Temporary developer entry point: resolve active athlete, analyze ring buffer,
 * and print Phase A readout plus raw S1/S2/S3 snapshots. Read-only — does not
 * reconcile or mutate competition sync state.
 */
export async function dumpCompetitionAuditorTrail(
  options: DumpCompetitionAuditorTrailOptions = {},
): Promise<DumpCompetitionAuditorTrailResult> {
  const deviceRole = await getDeviceRole();
  const authority = await captureAuthoritySnapshot({
    deviceRole,
    sourceTrigger: "export",
    skipCoachWriterSessionRefresh: true,
  });

  const sharedAthleteId =
    options.sharedAthleteId?.trim() || authority.resolvedOperatingAthleteId.trim() || null;

  if (!sharedAthleteId) {
    const readout = [
      DUMP_HEADER,
      "error=no_active_sharedAthleteId",
      `deviceRole=${deviceRole ?? "unknown"}`,
      `authorityBootstrap=${authority.authorityBootstrapState}`,
    ].join("\n");
    console.log(readout);
    return {
      sharedAthleteId: null,
      transitionId: null,
      analysis: null,
      snapshots: { s1: null, s2: null, s3: null },
      readout,
    };
  }

  const ring = await loadCompetitionStateAuditorRing();
  const analysis = analyzeCompetitionAuditorSnapshots({
    snapshots: ring.snapshots,
    sharedAthleteId,
    transitionId: options.transitionId,
    expectedCount: options.expectedCount,
  });
  const snapshots = selectPhaseABoundarySnapshots({
    snapshots: ring.snapshots,
    sharedAthleteId,
    transitionId: analysis.transitionId,
  });
  const readout = formatCompetitionAuditorReadout(analysis);

  console.log(DUMP_HEADER);
  console.log(readout);
  printBoundarySnapshot("--- S1 parent_canonical ---", snapshots.s1);
  printBoundarySnapshot("--- S2 parent_publish ---", snapshots.s2);
  printBoundarySnapshot("--- S3 worker_persist ---", snapshots.s3);

  return {
    sharedAthleteId,
    transitionId: analysis.transitionId,
    analysis,
    snapshots,
    readout,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var dumpCompetitionAuditorTrail:
    | ((options?: DumpCompetitionAuditorTrailOptions) => Promise<DumpCompetitionAuditorTrailResult>)
    | undefined;
}

/** Registers Metro / Xcode console access: `dumpCompetitionAuditorTrail()` */
export function registerDumpCompetitionAuditorTrailGlobal(): void {
  if (!__DEV__) return;
  globalThis.dumpCompetitionAuditorTrail = dumpCompetitionAuditorTrail;
}

registerDumpCompetitionAuditorTrailGlobal();
