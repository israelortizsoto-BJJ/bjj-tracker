import type { TimedTranscriptSegment } from "../types/timedTranscript";

/**
 * Resolve the TimedTranscript segment that covers a playhead time.
 *
 * Product Following helper only — does not own playback clocks, seek, or Session.
 * Half-open interval [startMs, endMs); exact end of the last segment is included.
 */
export function resolveActiveTimedTranscriptSegment(
  segments: readonly TimedTranscriptSegment[],
  timeMs: number,
): TimedTranscriptSegment | null {
  if (!Number.isFinite(timeMs) || timeMs < 0 || segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (timeMs >= segment.startMs && timeMs < segment.endMs) {
      return segment;
    }
  }

  const last = segments[segments.length - 1];
  if (last && timeMs === last.endMs) {
    return last;
  }

  return null;
}
