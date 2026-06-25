import {
  MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION,
  type CompetitionDomainBlock,
  type CompetitionPerimeterRow,
} from "./competitionStateAuditorContract";

export type CompetitionDomainBlockInputRow = {
  sharedCompetitionId: string;
  entryId?: string;
  shellUpdatedAt?: string | null;
  matches: readonly { id: string }[];
  artifactUpdatedAt?: string | null;
  overlayCount?: number;
};

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map(trimmed).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function lineageFingerprint(keys: readonly string[]): string | undefined {
  if (keys.length === 0) return undefined;
  const joined = keys.join("|");
  if (keys.length <= MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION) return undefined;
  let hash = 0;
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 31 + joined.charCodeAt(i)) >>> 0;
  }
  return `fp:${hash.toString(16)}`;
}

function projectRow(input: CompetitionDomainBlockInputRow): CompetitionPerimeterRow {
  const matchLineageKeys = uniqueSorted(input.matches.map((match) => match.id));
  return {
    sharedCompetitionId: trimmed(input.sharedCompetitionId),
    ...(input.entryId ? { entryId: trimmed(input.entryId) } : {}),
    ...(input.shellUpdatedAt !== undefined ? { shellUpdatedAt: input.shellUpdatedAt } : {}),
    matchCount: matchLineageKeys.length,
    matchLineageKeys: matchLineageKeys.slice(0, MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION),
    ...(lineageFingerprint(matchLineageKeys)
      ? { lineageFingerprint: lineageFingerprint(matchLineageKeys) }
      : {}),
    ...(input.artifactUpdatedAt !== undefined
      ? { artifactUpdatedAt: input.artifactUpdatedAt }
      : {}),
    ...(typeof input.overlayCount === "number" ? { overlayCount: input.overlayCount } : {}),
  };
}

export function projectCompetitionDomainBlock(
  rows: readonly CompetitionDomainBlockInputRow[],
): CompetitionDomainBlock {
  const perCompetition = rows
    .map(projectRow)
    .filter((row) => row.sharedCompetitionId)
    .sort((a, b) => a.sharedCompetitionId.localeCompare(b.sharedCompetitionId));
  const sharedCompetitionIds = perCompetition.map((row) => row.sharedCompetitionId);
  const totalMatchCount = perCompetition.reduce((sum, row) => sum + row.matchCount, 0);
  const detailPresentCount = perCompetition.filter((row) => row.matchCount > 0).length;

  return {
    competitionCount: perCompetition.length,
    totalMatchCount,
    sharedCompetitionIds,
    detailPresentCount,
    perCompetition,
  };
}

export function projectCompetitionDomainBlockFromIds(
  sharedCompetitionIds: readonly string[],
): CompetitionDomainBlock {
  return projectCompetitionDomainBlock(
    uniqueSorted(sharedCompetitionIds).map((sharedCompetitionId) => ({
      sharedCompetitionId,
      matches: [],
    })),
  );
}
