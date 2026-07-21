import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveActiveTimedTranscriptSegment } from "../resolveActiveTimedTranscriptSegment.ts";
import type { TimedTranscriptSegment } from "../../types/timedTranscript.ts";

const segments: TimedTranscriptSegment[] = [
  { id: "a", startMs: 0, endMs: 1000, text: "First" },
  { id: "b", startMs: 1000, endMs: 2500, text: "Second" },
  { id: "c", startMs: 2500, endMs: 4000, text: "Third" },
];

describe("resolveActiveTimedTranscriptSegment", () => {
  it("returns null for empty segments or invalid time", () => {
    assert.equal(resolveActiveTimedTranscriptSegment([], 0), null);
    assert.equal(resolveActiveTimedTranscriptSegment(segments, -1), null);
    assert.equal(resolveActiveTimedTranscriptSegment(segments, Number.NaN), null);
  });

  it("resolves half-open intervals and abutment boundaries", () => {
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 0)?.id, "a");
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 999)?.id, "a");
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 1000)?.id, "b");
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 2499)?.id, "b");
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 2500)?.id, "c");
  });

  it("includes the exact end of the last segment", () => {
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 4000)?.id, "c");
    assert.equal(resolveActiveTimedTranscriptSegment(segments, 4001), null);
  });

  it("returns null when time falls before the first or in a gap", () => {
    const gapped: TimedTranscriptSegment[] = [
      { id: "x", startMs: 100, endMs: 200, text: "X" },
      { id: "y", startMs: 500, endMs: 600, text: "Y" },
    ];
    assert.equal(resolveActiveTimedTranscriptSegment(gapped, 50), null);
    assert.equal(resolveActiveTimedTranscriptSegment(gapped, 300), null);
  });
});
