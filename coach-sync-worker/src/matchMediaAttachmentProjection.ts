import {
  attachmentRecordKey,
  decodeMatchMediaAttachmentRecord,
  type MatchMediaAttachment,
} from "../../shared-match-media-publication/src/index.ts";

const MAX_ATTACHMENT_PROJECTION_MATCHES = 256;

export type ProjectionMatch = { readonly matchLineageKey: string; readonly ordinal: number };
export type ProjectionCompetition = {
  readonly sharedCompetitionId: string;
  readonly sharedAthleteId: string;
  readonly matches: readonly ProjectionMatch[];
};
export type ProjectionTopologyArtifact = {
  readonly sharedAthleteId: string;
  readonly competitions: readonly ProjectionCompetition[];
};
export type AttachmentProjectionBucket = {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
};

export type MatchMediaAttachmentProjection =
  | {
      readonly sharedAthleteId: string;
      readonly sharedCompetitionId: string;
      readonly matchLineageKey: string;
      readonly revision: number;
      readonly state: "attached";
      readonly matchMediaAssetId: string;
      readonly publishedAt: string;
      readonly updatedAt: string;
    }
  | {
      readonly sharedAthleteId: string;
      readonly sharedCompetitionId: string;
      readonly matchLineageKey: string;
      readonly revision: number;
      readonly state: "tombstoned";
      readonly tombstonedAt: string;
      readonly updatedAt: string;
    };
export type MatchMediaAttachmentProjectionSet = {
  readonly schemaVersion: 1;
  readonly sharedAthleteId: string;
  readonly attachments: readonly MatchMediaAttachmentProjection[];
};

export function isAttachmentProjectionFeatureEnabled(value: string | undefined): boolean {
  return value === "1";
}

function projectionForRecord(record: MatchMediaAttachment): MatchMediaAttachmentProjection {
  if (record.state === "attached") {
    return {
      sharedAthleteId: record.sharedAthleteId,
      sharedCompetitionId: record.sharedCompetitionId,
      matchLineageKey: record.matchLineageKey,
      revision: record.revision,
      state: record.state,
      matchMediaAssetId: record.matchMediaAssetId,
      publishedAt: record.publishedAt,
      updatedAt: record.updatedAt,
    };
  }
  return {
    sharedAthleteId: record.sharedAthleteId,
    sharedCompetitionId: record.sharedCompetitionId,
    matchLineageKey: record.matchLineageKey,
    revision: record.revision,
    state: record.state,
    tombstonedAt: record.tombstonedAt,
    updatedAt: record.updatedAt,
  };
}

/** Topology is the ownership allowlist; records cannot create or expand it. */
export async function projectMatchMediaAttachmentsByAthlete(input: {
  enabled: boolean;
  bucket: AttachmentProjectionBucket;
  topologyByAthleteId: Readonly<Record<string, ProjectionTopologyArtifact>>;
}): Promise<Record<string, MatchMediaAttachmentProjectionSet>> {
  if (!input.enabled) return {};
  const candidates = Object.values(input.topologyByAthleteId)
    .flatMap((artifact) =>
      artifact.competitions.flatMap((competition) =>
        competition.matches.map((match) => ({
          sharedAthleteId: artifact.sharedAthleteId.trim(),
          sharedCompetitionId: competition.sharedCompetitionId.trim(),
          competitionAthleteId: competition.sharedAthleteId.trim(),
          matchLineageKey: match.matchLineageKey.trim(),
          ordinal: match.ordinal,
        })),
      ),
    )
    .filter(
      (candidate) =>
        candidate.sharedAthleteId &&
        candidate.sharedCompetitionId &&
        candidate.matchLineageKey &&
        candidate.sharedAthleteId === candidate.competitionAthleteId,
    )
    .sort(
      (left, right) =>
        left.sharedAthleteId.localeCompare(right.sharedAthleteId) ||
        left.sharedCompetitionId.localeCompare(right.sharedCompetitionId) ||
        left.ordinal - right.ordinal ||
        left.matchLineageKey.localeCompare(right.matchLineageKey),
    );
  if (candidates.length > MAX_ATTACHMENT_PROJECTION_MATCHES) return {};

  const byAthlete: Record<string, MatchMediaAttachmentProjection[]> = {};
  for (const candidate of candidates) {
    const object = await input.bucket.get(
      attachmentRecordKey({
        sharedAthleteId: candidate.sharedAthleteId,
        sharedCompetitionId: candidate.sharedCompetitionId,
        matchLineageKey: candidate.matchLineageKey,
      }),
    );
    if (!object) continue;
    const record = decodeMatchMediaAttachmentRecord(await object.text());
    if (
      !record ||
      record.sharedAthleteId !== candidate.sharedAthleteId ||
      record.sharedCompetitionId !== candidate.sharedCompetitionId ||
      record.matchLineageKey !== candidate.matchLineageKey
    ) continue;
    (byAthlete[candidate.sharedAthleteId] ??= []).push(projectionForRecord(record));
  }
  return Object.fromEntries(
    Object.entries(byAthlete)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sharedAthleteId, attachments]) => [
      sharedAthleteId,
      { schemaVersion: 1, sharedAthleteId, attachments },
      ]),
  );
}
