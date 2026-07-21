import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseTimedTranscript,
  TIMED_TRANSCRIPT_SOURCE_WHISPER,
  TIMED_TRANSCRIPT_VERSION,
  type TimedTranscript,
} from "../../types/timedTranscript.ts";

function validTranscript(
  overrides: Partial<TimedTranscript> = {},
): TimedTranscript {
  return {
    version: TIMED_TRANSCRIPT_VERSION,
    source: TIMED_TRANSCRIPT_SOURCE_WHISPER,
    audioUri: "file:///docs/media/coach-voice/note.m4a",
    createdAt: "2026-07-20T16:00:00.000Z",
    segments: [
      { id: "seg-0", startMs: 0, endMs: 1200, text: "Stay patient." },
    ],
    ...overrides,
  };
}

describe("parseTimedTranscript schema validation", () => {
  it("accepts a valid TimedTranscript", () => {
    const input = validTranscript();
    assert.deepEqual(parseTimedTranscript(input), input);
  });

  it("accepts empty segments", () => {
    const input = validTranscript({ segments: [] });
    assert.deepEqual(parseTimedTranscript(input), input);
  });

  it("returns null for null / non-object / array", () => {
    assert.equal(parseTimedTranscript(null), null);
    assert.equal(parseTimedTranscript(undefined), null);
    assert.equal(parseTimedTranscript("x"), null);
    assert.equal(parseTimedTranscript([]), null);
  });

  it("returns null for wrong version or source", () => {
    assert.equal(parseTimedTranscript(validTranscript({ version: 2 as never })), null);
    assert.equal(
      parseTimedTranscript({ ...validTranscript(), source: "other" }),
      null,
    );
  });

  it("returns null for missing audioUri or createdAt", () => {
    assert.equal(parseTimedTranscript(validTranscript({ audioUri: "  " })), null);
    assert.equal(parseTimedTranscript(validTranscript({ createdAt: "" })), null);
    assert.equal(
      parseTimedTranscript({ ...validTranscript(), audioUri: 1 }),
      null,
    );
  });

  it("returns null when segments is not an array", () => {
    assert.equal(
      parseTimedTranscript({ ...validTranscript(), segments: {} }),
      null,
    );
  });

  it("returns null when any segment is invalid", () => {
    assert.equal(
      parseTimedTranscript(
        validTranscript({
          segments: [{ id: "", startMs: 0, endMs: 1, text: "x" }],
        }),
      ),
      null,
    );
    assert.equal(
      parseTimedTranscript(
        validTranscript({
          segments: [{ id: "a", startMs: -1, endMs: 1, text: "x" }],
        }),
      ),
      null,
    );
    assert.equal(
      parseTimedTranscript(
        validTranscript({
          segments: [{ id: "a", startMs: 10, endMs: 5, text: "x" }],
        }),
      ),
      null,
    );
    assert.equal(
      parseTimedTranscript(
        validTranscript({
          segments: [{ id: "a", startMs: 0, endMs: 1, text: 9 as never }],
        }),
      ),
      null,
    );
  });

  it("trims audioUri and createdAt", () => {
    const parsed = parseTimedTranscript(
      validTranscript({
        audioUri: "  file:///a.m4a  ",
        createdAt: "  2026-07-20T16:00:00.000Z  ",
      }),
    );
    assert.equal(parsed?.audioUri, "file:///a.m4a");
    assert.equal(parsed?.createdAt, "2026-07-20T16:00:00.000Z");
  });
});
