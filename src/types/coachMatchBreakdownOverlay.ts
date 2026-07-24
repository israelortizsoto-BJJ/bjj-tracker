export type CoachMatchBreakdownOverlayIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
};

/**
 * Companion audio reference for coach commentary.
 * Transcript (`coachNote`) remains canonical; this is metadata + local URI only.
 * Phase 1: coach-device local persistence. No blob sync.
 * Phase 2: optional `mediaId` after best-effort remote upload (never sync localUri).
 */
export type VoiceNoteRef = {
  id: string;
  localUri: string;
  createdAt: string;
  mimeType?: string;
  durationMs?: number;
  /** Remote object id from worker media upload. Domain metadata only — never a URL. */
  mediaId?: string;
  /** Optional durable shared-video alignment captured for this recording attempt only. */
  alignment?: {
    commentaryStartVideoMs: number;
    matchMediaAssetId: string;
    attachmentRevision: number;
  };
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

/** In-memory guard for one VoiceNote recording attempt; never persisted. */
export function createVoiceNoteAttemptGate() {
  let nextId = 0;
  let activeId: number | null = null;
  return {
    acquire(): number | null {
      if (activeId !== null) return null;
      activeId = ++nextId;
      return activeId;
    },
    isActive(id: number): boolean {
      return activeId === id;
    },
    release(id: number): void {
      if (activeId === id) activeId = null;
    },
    cancel(): void {
      activeId = null;
    },
  };
}

export async function beginVoiceNoteAttempt<T>(input: {
  gate: ReturnType<typeof createVoiceNoteAttemptGate>;
  prepare: () => Promise<T>;
}): Promise<{ id: number; value: T } | null> {
  const id = input.gate.acquire();
  if (id === null) return null;
  try {
    const value = await input.prepare();
    if (!input.gate.isActive(id)) throw new Error("VoiceNote attempt is stale.");
    return { id, value };
  } catch (error) {
    input.gate.release(id);
    throw error;
  }
}

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
  const mediaId =
    typeof row.mediaId === "string" && /^[a-f0-9]{32}$/i.test(row.mediaId.trim())
      ? row.mediaId.trim().toLowerCase()
      : undefined;
  const rawAlignment = row.alignment;
  const alignment =
    rawAlignment && typeof rawAlignment === "object" && !Array.isArray(rawAlignment)
      ? rawAlignment as Record<string, unknown>
      : null;
  const commentaryStartVideoMs = alignment?.commentaryStartVideoMs;
  const matchMediaAssetId = typeof alignment?.matchMediaAssetId === "string"
    ? alignment.matchMediaAssetId.trim()
    : "";
  const attachmentRevision = alignment?.attachmentRevision;
  const validAlignment =
    typeof commentaryStartVideoMs === "number" &&
    Number.isSafeInteger(commentaryStartVideoMs) &&
    commentaryStartVideoMs >= 0 &&
    Boolean(matchMediaAssetId) &&
    typeof attachmentRevision === "number" &&
    Number.isSafeInteger(attachmentRevision) &&
    attachmentRevision > 0;
  return {
    id,
    localUri,
    createdAt,
    ...(mimeType ? { mimeType } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(validAlignment
      ? { alignment: { commentaryStartVideoMs, matchMediaAssetId, attachmentRevision } }
      : {}),
  };
}

export function normalizeVoiceNoteRefs(value: unknown): VoiceNoteRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value
    .map((entry) => normalizeVoiceNoteRef(entry))
    .filter((entry): entry is VoiceNoteRef => entry !== null);
  return refs.length > 0 ? refs : undefined;
}
