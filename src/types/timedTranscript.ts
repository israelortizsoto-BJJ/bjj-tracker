/**
 * Coach-local Timed Transcript evidence object.
 *
 * Capture + persist + read + validate are certified.
 * Film Room product may consume it through the read helper and Session time
 * (Transcript Following). Separate from editable coachNote prose.
 * Not synced to Parent / worker.
 */

export const TIMED_TRANSCRIPT_VERSION = 1 as const;

export const TIMED_TRANSCRIPT_SOURCE_WHISPER = "whisper-1" as const;

export type TimedTranscriptSource = typeof TIMED_TRANSCRIPT_SOURCE_WHISPER;

export type TimedTranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type TimedTranscript = {
  version: typeof TIMED_TRANSCRIPT_VERSION;
  source: TimedTranscriptSource;
  audioUri: string;
  createdAt: string;
  segments: TimedTranscriptSegment[];
};

function parseTimedTranscriptSegment(value: unknown): TimedTranscriptSegment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const text = typeof row.text === "string" ? row.text : null;
  const startMs = row.startMs;
  const endMs = row.endMs;
  if (!id || text === null) return null;
  if (typeof startMs !== "number" || !Number.isFinite(startMs) || startMs < 0) return null;
  if (typeof endMs !== "number" || !Number.isFinite(endMs) || endMs < startMs) return null;
  return { id, startMs, endMs, text };
}

/**
 * Validate unknown JSON into a TimedTranscript.
 * Returns null for any schema violation (never throws).
 */
export function parseTimedTranscript(value: unknown): TimedTranscript | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== TIMED_TRANSCRIPT_VERSION) return null;
  if (row.source !== TIMED_TRANSCRIPT_SOURCE_WHISPER) return null;
  const audioUri = typeof row.audioUri === "string" ? row.audioUri.trim() : "";
  const createdAt = typeof row.createdAt === "string" ? row.createdAt.trim() : "";
  if (!audioUri || !createdAt) return null;
  if (!Array.isArray(row.segments)) return null;

  const segments: TimedTranscriptSegment[] = [];
  for (const entry of row.segments) {
    const segment = parseTimedTranscriptSegment(entry);
    if (!segment) return null;
    segments.push(segment);
  }

  return {
    version: TIMED_TRANSCRIPT_VERSION,
    source: TIMED_TRANSCRIPT_SOURCE_WHISPER,
    audioUri,
    createdAt,
    segments,
  };
}
