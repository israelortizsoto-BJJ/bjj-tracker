import { deriveCompetitionProjectionSource } from "../domain/competition/projectCompetitionCompeteView";
import type { AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { CoachCompetitionTopologyPeekResult } from "../storage/coachCompetitionTopologyStore";
import type { KidCompetitionEntryWithMatchDetail } from "../storage/competitionStore";
import type { SyncedCompetitionTopologyArtifact } from "../types/coachWeeklySync";
import type { KidCompetitionEntry } from "../types/coachKid";

import type { AuthoritySnapshot } from "./authoritySnapshotContract";
import {
  projectTopologySnapshot,
  type ProjectTopologySnapshotAthleteContext,
  type TopologySnapshotCompetitionProbe,
} from "./projectTopologySnapshot";
import type { TopologySnapshot } from "./topologySnapshotContract";

function capturedAtFallback(): string {
  return new Date(0).toISOString();
}

export type CaptureTopologySnapshotOptions = {
  authority: AuthoritySnapshot;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  /** Test hook — defaults to `new Date().toISOString()`. */
  capturedAt?: string;
  isSyncConfigured?: () => boolean;
  isMemoryLoaded?: () => boolean;
  peekOutcome?: (sharedAthleteId: string) => CoachCompetitionTopologyPeekResult;
  readDiskArtifact?: (sharedAthleteId: string) => Promise<SyncedCompetitionTopologyArtifact | null>;
  getCompetitionShells?: (sharedAthleteId: string) => Promise<KidCompetitionEntry[]>;
  getEntriesWithMatchDetail?: (
    sharedAthleteId: string,
  ) => Promise<KidCompetitionEntryWithMatchDetail[]>;
};

async function defaultCompetitionShells(sharedAthleteId: string): Promise<KidCompetitionEntry[]> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return [];
  const { getKidCompetitionEntries } = await import("../storage/kidCompetitionStore");
  const entries = await getKidCompetitionEntries();
  return entries.filter((entry) => (entry.sharedAthleteId ?? "").trim() === athleteId);
}

async function defaultEntriesWithMatchDetail(
  sharedAthleteId: string,
): Promise<KidCompetitionEntryWithMatchDetail[]> {
  const { getKidCompetitionEntriesWithMatchDetailForSharedAthlete } = await import(
    "../storage/competitionStore"
  );
  return getKidCompetitionEntriesWithMatchDetailForSharedAthlete(sharedAthleteId);
}

async function defaultReadDiskArtifact(
  sharedAthleteId: string,
): Promise<SyncedCompetitionTopologyArtifact | null> {
  const { getCoachCompetitionTopology } = await import("../storage/coachCompetitionTopologyStore");
  return getCoachCompetitionTopology(sharedAthleteId);
}

async function loadProductionProbeDeps(): Promise<
  Required<
    Pick<
      CaptureTopologySnapshotOptions,
      | "isSyncConfigured"
      | "isMemoryLoaded"
      | "peekOutcome"
      | "readDiskArtifact"
      | "getCompetitionShells"
      | "getEntriesWithMatchDetail"
    >
  >
> {
  const [{ isCoachSyncConfigured }, topologyStore] = await Promise.all([
    import("../config/coachSync"),
    import("../storage/coachCompetitionTopologyStore"),
  ]);
  return {
    isSyncConfigured: isCoachSyncConfigured,
    isMemoryLoaded: topologyStore.isCoachCompetitionTopologyMemoryLoaded,
    peekOutcome: topologyStore.peekCoachCompetitionTopologyOutcome,
    readDiskArtifact: defaultReadDiskArtifact,
    getCompetitionShells: defaultCompetitionShells,
    getEntriesWithMatchDetail: defaultEntriesWithMatchDetail,
  };
}

async function probeAthleteDomain(
  sharedAthleteId: string,
  deps: Required<
    Pick<
      CaptureTopologySnapshotOptions,
      "isMemoryLoaded" | "peekOutcome" | "readDiskArtifact" | "getCompetitionShells" | "getEntriesWithMatchDetail"
    >
  >,
): Promise<ProjectTopologySnapshotAthleteContext> {
  const athleteId = sharedAthleteId.trim();
  const memoryLoaded = deps.isMemoryLoaded();
  const peek = deps.peekOutcome(athleteId);
  const diskArtifact = await deps.readDiskArtifact(athleteId);

  const shells = await deps.getCompetitionShells(athleteId);
  const detailEntries = await deps.getEntriesWithMatchDetail(athleteId);
  const detailByCompetitionId = new Map(
    detailEntries
      .map((entry) => [entry.sharedCompetitionId?.trim() ?? "", entry] as const)
      .filter(([id]) => Boolean(id)),
  );

  const competitionIds = new Set<string>();
  for (const competition of peek.artifact?.competitions ?? []) {
    const id = competition.sharedCompetitionId.trim();
    if (id) competitionIds.add(id);
  }
  for (const competition of diskArtifact?.competitions ?? []) {
    const id = competition.sharedCompetitionId.trim();
    if (id) competitionIds.add(id);
  }
  for (const shell of shells) {
    const id = shell.sharedCompetitionId?.trim() ?? "";
    if (id) competitionIds.add(id);
  }

  const competitionProbes: TopologySnapshotCompetitionProbe[] = [];
  for (const sharedCompetitionId of [...competitionIds].sort((a, b) => a.localeCompare(b))) {
    const shell =
      shells.find((entry) => (entry.sharedCompetitionId?.trim() ?? "") === sharedCompetitionId) ??
      ({
        id: sharedCompetitionId,
        kidId: "",
        tournamentName: "",
        eventDate: "",
        createdAt: capturedAtFallback(),
        updatedAt: capturedAtFallback(),
        sharedAthleteId: athleteId,
        sharedCompetitionId,
      } satisfies KidCompetitionEntry);
    const detail = detailByCompetitionId.get(sharedCompetitionId);
    const substrate =
      peek.artifact?.competitions.find(
        (competition) => competition.sharedCompetitionId === sharedCompetitionId,
      ) ??
      diskArtifact?.competitions.find(
        (competition) => competition.sharedCompetitionId === sharedCompetitionId,
      ) ??
      null;

    competitionProbes.push({
      sharedCompetitionId,
      competitionLineageKey: substrate?.competitionLineageKey ?? sharedCompetitionId,
      updatedAt: substrate?.updatedAt ?? "",
      matchLineageKeys: (substrate?.matches ?? []).map((match) => match.matchLineageKey),
      projectionSource: deriveCompetitionProjectionSource({
        shell,
        topologyArtifact: peek.artifact,
        fallbackMatches: detail?.matches ?? [],
      }),
    });
  }

  return {
    sharedAthleteId: athleteId,
    memoryLoaded,
    peekOutcome: peek.outcome,
    peekArtifact: peek.artifact,
    diskArtifact,
    competitionProbes,
  };
}

/**
 * Generates a production-safe Topology Snapshot from coach P3 substrate truth.
 * Read-only: must not reconcile or write topology stores.
 */
export async function captureTopologySnapshot(
  options: CaptureTopologySnapshotOptions,
): Promise<TopologySnapshot> {
  if (options.authority.deviceRole !== "coach") {
    throw new Error("captureTopologySnapshot: deviceRole must be coach");
  }

  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const needsProduction =
    options.isSyncConfigured === undefined ||
    options.isMemoryLoaded === undefined ||
    options.peekOutcome === undefined ||
    options.readDiskArtifact === undefined ||
    options.getCompetitionShells === undefined ||
    options.getEntriesWithMatchDetail === undefined;
  const productionDeps = needsProduction ? await loadProductionProbeDeps() : null;

  const syncConfigured = (options.isSyncConfigured ?? productionDeps?.isSyncConfigured ?? (() => false))();
  const deps = {
    isMemoryLoaded: options.isMemoryLoaded ?? productionDeps!.isMemoryLoaded,
    peekOutcome: options.peekOutcome ?? productionDeps!.peekOutcome,
    readDiskArtifact: options.readDiskArtifact ?? productionDeps!.readDiskArtifact,
    getCompetitionShells: options.getCompetitionShells ?? productionDeps!.getCompetitionShells,
    getEntriesWithMatchDetail:
      options.getEntriesWithMatchDetail ?? productionDeps!.getEntriesWithMatchDetail,
  };

  const operatingAthleteId = options.authority.resolvedOperatingAthleteId.trim();
  const athleteDomain = await probeAthleteDomain(operatingAthleteId, deps);

  const linkedIds = options.authority.linkedSharedAthleteIds
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id) => id !== operatingAthleteId);

  const additionalAthleteDomains =
    linkedIds.length > 0
      ? await Promise.all(linkedIds.map((id) => probeAthleteDomain(id, deps)))
      : undefined;

  const visibleCompetitionIds = (await deps.getCompetitionShells(operatingAthleteId))
    .map((shell) => shell.sharedCompetitionId?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return projectTopologySnapshot({
    capturedAt,
    syncConfigured,
    captureMode: "coach_substrate_probe",
    sourceTrigger: options.sourceTrigger,
    athleteDomain,
    ...(additionalAthleteDomains && additionalAthleteDomains.length > 0
      ? { additionalAthleteDomains }
      : {}),
    ...(visibleCompetitionIds.length > 0 ? { visibleCompetitionIds } : {}),
  });
}
