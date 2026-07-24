/**
 * Coach Match Breakdown artifact parse helpers for coach-sync-worker.
 * Schema v1 strips alignment; schema v2 retains validated alignment.
 */

const MAX_TOPOLOGY_ID_CHARS = 200;
const MAX_COACH_BREAKDOWN_ARTIFACTS_PER_ATHLETE = 2048;
const MAX_COACH_BREAKDOWN_TEXT_CHARS = 8_000;
const MAX_COACH_BREAKDOWN_PAYLOAD_CHARS = 256_000;
const MEDIA_ID_RE = /^[a-f0-9]{32}$/i;
const ALLOWED_COACH_MEDIA_MIME = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "application/octet-stream",
]);

export type CoachMatchBreakdownArtifact = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  coachNote?: string;
  /** Remote companion audio id (R2). Never a URL or localUri. */
  mediaId?: string;
  durationMs?: number;
  mimeType?: string;
  alignment?: {
    commentaryStartVideoMs: number;
    matchMediaAssetId: string;
    attachmentRevision: number;
  };
  updatedAt: string;
};

export type CoachMatchBreakdownArtifactSet = {
  schemaVersion: 1 | 2;
  sharedAthleteId: string;
  updatedAt: string;
  artifacts: CoachMatchBreakdownArtifact[];
};

function parseTopologyId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > MAX_TOPOLOGY_ID_CHARS) return null;
  return id;
}

export function parseCoachMatchBreakdownArtifact(
  raw: unknown,
): CoachMatchBreakdownArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sharedAthleteId = parseTopologyId(o.sharedAthleteId);
  const sharedCompetitionId = parseTopologyId(o.sharedCompetitionId);
  const matchLineageKey = parseTopologyId(o.matchLineageKey);
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  const coachNoteRaw = typeof o.coachNote === "string" ? o.coachNote.trim() : "";
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey || !updatedAt) return null;
  if (coachNoteRaw.length > MAX_COACH_BREAKDOWN_TEXT_CHARS) return null;
  // Domain metadata only — reject any attempt to sync URLs or local paths.
  if (
    typeof o.localUri === "string" ||
    typeof o.url === "string" ||
    typeof o.audioUrl === "string" ||
    typeof o.playableUri === "string"
  ) {
    return null;
  }
  if ("voiceNoteRefs" in o) return null;
  const mediaIdRaw = typeof o.mediaId === "string" ? o.mediaId.trim() : "";
  const mediaId = mediaIdRaw && MEDIA_ID_RE.test(mediaIdRaw) ? mediaIdRaw.toLowerCase() : "";
  if (mediaIdRaw && !mediaId) return null;
  const mimeTypeRaw = typeof o.mimeType === "string" ? o.mimeType.trim().toLowerCase() : "";
  const mimeType =
    mimeTypeRaw && mimeTypeRaw.length <= 80 && ALLOWED_COACH_MEDIA_MIME.has(mimeTypeRaw)
      ? mimeTypeRaw
      : "";
  if (mimeTypeRaw && !mimeType) return null;
  const durationMs =
    typeof o.durationMs === "number" && Number.isFinite(o.durationMs) && o.durationMs >= 0
      ? Math.min(Math.floor(o.durationMs), 24 * 60 * 60 * 1000)
      : undefined;
  const alignmentRaw = o.alignment;
  const alignmentRow =
    alignmentRaw && typeof alignmentRaw === "object" && !Array.isArray(alignmentRaw)
      ? (alignmentRaw as Record<string, unknown>)
      : null;
  const commentaryStartVideoMs = alignmentRow?.commentaryStartVideoMs;
  const matchMediaAssetId =
    typeof alignmentRow?.matchMediaAssetId === "string"
      ? alignmentRow.matchMediaAssetId.trim()
      : "";
  const attachmentRevision = alignmentRow?.attachmentRevision;
  const alignment =
    typeof commentaryStartVideoMs === "number" &&
    Number.isSafeInteger(commentaryStartVideoMs) &&
    commentaryStartVideoMs >= 0 &&
    Boolean(matchMediaAssetId) &&
    typeof attachmentRevision === "number" &&
    Number.isSafeInteger(attachmentRevision) &&
    attachmentRevision > 0
      ? { commentaryStartVideoMs, matchMediaAssetId, attachmentRevision }
      : undefined;
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    ...(coachNoteRaw ? { coachNote: coachNoteRaw } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(alignment ? { alignment } : {}),
    updatedAt,
  };
}

export function parseCoachMatchBreakdownArtifactSet(
  raw: unknown,
): CoachMatchBreakdownArtifactSet | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (JSON.stringify(raw).length > MAX_COACH_BREAKDOWN_PAYLOAD_CHARS) return null;
  const o = raw as Record<string, unknown>;
  if ((o.schemaVersion !== 1 && o.schemaVersion !== 2) || !Array.isArray(o.artifacts)) return null;
  const sharedAthleteId = parseTopologyId(o.sharedAthleteId);
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!sharedAthleteId || !updatedAt) return null;
  if (o.artifacts.length > MAX_COACH_BREAKDOWN_ARTIFACTS_PER_ATHLETE) return null;

  const identityKeys = new Set<string>();
  const artifacts: CoachMatchBreakdownArtifact[] = [];
  for (const rawArtifact of o.artifacts) {
    const artifact = parseCoachMatchBreakdownArtifact(rawArtifact);
    if (!artifact || artifact.sharedAthleteId !== sharedAthleteId) return null;
    const identityKey = JSON.stringify([
      artifact.sharedAthleteId,
      artifact.sharedCompetitionId,
      artifact.matchLineageKey,
    ]);
    if (identityKeys.has(identityKey)) return null;
    identityKeys.add(identityKey);
    artifacts.push(
      o.schemaVersion === 2 ? artifact : { ...artifact, alignment: undefined },
    );
  }

  return {
    schemaVersion: o.schemaVersion,
    sharedAthleteId,
    updatedAt,
    artifacts,
  };
}

export function parseCoachMatchBreakdownArtifacts(
  raw: unknown,
): Record<string, CoachMatchBreakdownArtifactSet> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CoachMatchBreakdownArtifactSet> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > MAX_TOPOLOGY_ID_CHARS) continue;
    const artifactSet = parseCoachMatchBreakdownArtifactSet(value);
    if (!artifactSet || artifactSet.sharedAthleteId !== id) continue;
    out[id] = artifactSet;
  }
  return out;
}
