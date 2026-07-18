export type CoachMatchBreakdownOverlayIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
};

/**
 * Companion audio reference for coach commentary.
 * Transcript (`coachNote`) remains canonical; this is metadata + local URI only.
 * Phase 1: coach-device local persistence. No blob sync.
 */
export type VoiceNoteRef = {
  id: string;
  localUri: string;
  createdAt: string;
  mimeType?: string;
  durationMs?: number;
};

/** Coach-owned interpretation only. Canonical competition facts must never enter this row. */
export type CoachMatchBreakdownOverlay = CoachMatchBreakdownOverlayIdentity & {
  coachNote?: string;
  dictatedReflection?: string;
  analysis?: string;
  /** Optional companion audio refs. Single voice corridor — at most one active recording. */
  voiceNoteRefs?: VoiceNoteRef[];
  updatedAt: string;
};

/** Null or empty text clears one annotation field without touching canonical topology. */
export type CoachMatchBreakdownOverlayPatch = {
  coachNote?: string | null;
  dictatedReflection?: string | null;
  analysis?: string | null;
  /** Null or empty array clears companion audio refs. */
  voiceNoteRefs?: VoiceNoteRef[] | null;
};

export function normalizeVoiceNoteRef(value: unknown): VoiceNoteRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const localUri = typeof row.localUri === "string" ? row.localUri.trim() : "";
  const createdAt = typeof row.createdAt === "string" ? row.createdAt.trim() : "";
  if (!id || !localUri || !createdAt) return null;
  const mimeType =
    typeof row.mimeType === "string" && row.mimeType.trim() ? row.mimeType.trim() : undefined;
  const durationMs =
    typeof row.durationMs === "number" && Number.isFinite(row.durationMs) && row.durationMs >= 0
      ? row.durationMs
      : undefined;
  return {
    id,
    localUri,
    createdAt,
    ...(mimeType ? { mimeType } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

export function normalizeVoiceNoteRefs(value: unknown): VoiceNoteRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value
    .map((entry) => normalizeVoiceNoteRef(entry))
    .filter((entry): entry is VoiceNoteRef => entry !== null);
  return refs.length > 0 ? refs : undefined;
}
