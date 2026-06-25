/** Worker-side Competition State Auditor (Phase A). Mirrors app contract shape. */

export const COMPETITION_STATE_AUDITOR_CONTRACT_VERSION = "2" as const;

export const MATMIND_AUDIT_SNAPSHOT_HEADER = "X-MatMind-Audit-Snapshot" as const;

export const MATMIND_TRANSITION_HEADER = "X-MatMind-Transition-Id" as const;

type CompetitionPerimeterRow = {
  sharedCompetitionId: string;
  matchCount: number;
  matchLineageKeys: string[];
};

type CompetitionDomainBlock = {
  competitionCount: number;
  totalMatchCount: number;
  sharedCompetitionIds: string[];
  detailPresentCount: number;
  perCompetition: CompetitionPerimeterRow[];
};

type SharedCompetition = {
  id: string;
  sharedAthleteId: string;
  updatedAt?: string;
};

type CompetitionTopologyMatch = {
  matchLineageKey: string;
};

type CompetitionTopologyCompetition = {
  sharedCompetitionId: string;
  matches: CompetitionTopologyMatch[];
};

type CompetitionTopologyArtifact = {
  updatedAt: string;
  competitions: CompetitionTopologyCompetition[];
};

type SessionRecord = {
  competitions: SharedCompetition[];
  competitionTopologyByAthleteId?: Record<string, CompetitionTopologyArtifact>;
  competitionAggregateByAthleteId?: Record<string, { updatedAt: string; totalCompetitions?: number }>;
};

export type WorkerPersistLane =
  | "shell_post"
  | "shell_put"
  | "shell_delete"
  | "aggregate_put"
  | "topology_put";

export type WorkerPersistSnapshot = {
  contractVersion: typeof COMPETITION_STATE_AUDITOR_CONTRACT_VERSION;
  snapshotKind: "worker_persist";
  transitionId: string;
  parentTransitionId?: string;
  capturedAt: string;
  deviceRole: "worker";
  sharedAthleteId: string;
  linkTokenTail?: string;
  persistLane: WorkerPersistLane;
  generation?: string;
  domain: CompetitionDomainBlock;
  beforeCompetitionCount: number;
  afterCompetitionCount: number;
  sessionCompetitionCount: number;
  rejectReason?: string;
};

function sortedIds(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function athleteCompetitions(rec: SessionRecord, sharedAthleteId: string): SharedCompetition[] {
  const sid = sharedAthleteId.trim();
  return rec.competitions.filter((competition) => competition.sharedAthleteId === sid);
}

function topologyRowsForAthlete(
  rec: SessionRecord,
  sharedAthleteId: string,
): CompetitionPerimeterRow[] {
  const artifact = rec.competitionTopologyByAthleteId?.[sharedAthleteId.trim()];
  if (!artifact) return [];
  return artifact.competitions.map((competition) => ({
    sharedCompetitionId: competition.sharedCompetitionId,
    matchCount: competition.matches.length,
    matchLineageKeys: sortedIds(competition.matches.map((match) => match.matchLineageKey)),
  }));
}

function buildDomainFromShells(competitions: SharedCompetition[]): CompetitionDomainBlock {
  const perCompetition = competitions
    .map((competition) => ({
      sharedCompetitionId: competition.id,
      matchCount: 0,
      matchLineageKeys: [] as string[],
    }))
    .sort((a, b) => a.sharedCompetitionId.localeCompare(b.sharedCompetitionId));
  return {
    competitionCount: perCompetition.length,
    totalMatchCount: 0,
    sharedCompetitionIds: perCompetition.map((row) => row.sharedCompetitionId),
    detailPresentCount: 0,
    perCompetition,
  };
}

function buildDomainFromTopology(
  rec: SessionRecord,
  sharedAthleteId: string,
): CompetitionDomainBlock {
  const topologyRows = topologyRowsForAthlete(rec, sharedAthleteId);
  if (topologyRows.length > 0) {
    const sharedCompetitionIds = sortedIds(topologyRows.map((row) => row.sharedCompetitionId));
    const totalMatchCount = topologyRows.reduce((sum, row) => sum + row.matchCount, 0);
    return {
      competitionCount: topologyRows.length,
      totalMatchCount,
      sharedCompetitionIds,
      detailPresentCount: topologyRows.filter((row) => row.matchCount > 0).length,
      perCompetition: topologyRows.sort((a, b) =>
        a.sharedCompetitionId.localeCompare(b.sharedCompetitionId),
      ),
    };
  }
  return buildDomainFromShells(athleteCompetitions(rec, sharedAthleteId));
}

export function buildWorkerPersistSnapshot(input: {
  before: SessionRecord;
  after: SessionRecord;
  sharedAthleteId: string;
  persistLane: WorkerPersistLane;
  transitionId: string;
  linkTokenTail?: string;
  rejectReason?: string;
  capturedAt?: string;
}): WorkerPersistSnapshot {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const beforeRows = athleteCompetitions(input.before, sharedAthleteId);
  const afterRows = athleteCompetitions(input.after, sharedAthleteId);
  const domain = buildDomainFromTopology(input.after, sharedAthleteId);
  const aggregateUpdatedAt =
    input.after.competitionAggregateByAthleteId?.[sharedAthleteId]?.updatedAt;
  const topologyUpdatedAt =
    input.after.competitionTopologyByAthleteId?.[sharedAthleteId]?.updatedAt;
  const generation = topologyUpdatedAt ?? aggregateUpdatedAt;

  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "worker_persist",
    transitionId: input.transitionId,
    parentTransitionId: input.transitionId,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    deviceRole: "worker",
    sharedAthleteId,
    ...(input.linkTokenTail ? { linkTokenTail: input.linkTokenTail } : {}),
    persistLane: input.persistLane,
    ...(generation ? { generation } : {}),
    domain,
    beforeCompetitionCount: beforeRows.length,
    afterCompetitionCount: afterRows.length,
    sessionCompetitionCount: input.after.competitions.length,
    ...(input.rejectReason ? { rejectReason: input.rejectReason } : {}),
  };
}

export function serializeWorkerPersistSnapshot(snapshot: WorkerPersistSnapshot): string {
  return JSON.stringify(snapshot);
}

export function readTransitionIdFromRequest(request: Request): string | undefined {
  const header = request.headers.get(MATMIND_TRANSITION_HEADER);
  const trimmed = typeof header === "string" ? header.trim() : "";
  return trimmed || undefined;
}
