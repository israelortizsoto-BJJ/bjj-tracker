import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  beginVoiceNoteAttempt,
  createVoiceNoteAttemptGate,
  normalizeVoiceNoteRef,
} from "../coachMatchBreakdownOverlay.ts";

const base = {
  id: "voice-1",
  localUri: "file:///voice.m4a",
  createdAt: "2026-07-24T12:00:00.000Z",
};

describe("VoiceNote alignment contract", () => {
  it("retains only a complete valid alignment", () => {
    assert.deepEqual(normalizeVoiceNoteRef({
      ...base,
      alignment: { commentaryStartVideoMs: 42, matchMediaAssetId: "mma_1", attachmentRevision: 3 },
    })?.alignment, { commentaryStartVideoMs: 42, matchMediaAssetId: "mma_1", attachmentRevision: 3 });
  });

  it("drops malformed or partial alignment without changing legacy VoiceNoteRefs", () => {
    for (const alignment of [
      { commentaryStartVideoMs: -1, matchMediaAssetId: "mma_1", attachmentRevision: 1 },
      { commentaryStartVideoMs: 1.5, matchMediaAssetId: "mma_1", attachmentRevision: 1 },
      { commentaryStartVideoMs: 1, matchMediaAssetId: " ", attachmentRevision: 1 },
      { commentaryStartVideoMs: 1, matchMediaAssetId: "mma_1", attachmentRevision: 0 },
      { commentaryStartVideoMs: 1, matchMediaAssetId: "mma_1" },
    ]) assert.equal(normalizeVoiceNoteRef({ ...base, alignment })?.alignment, undefined);
    assert.deepEqual(normalizeVoiceNoteRef(base), base);
  });

  it("serializes recording attempts and defeats stale completions", () => {
    const gate = createVoiceNoteAttemptGate();
    const first = gate.acquire();
    assert.equal(first, 1);
    assert.equal(gate.acquire(), null);
    assert.equal(gate.isActive(first!), true);
    gate.release(first!);
    const second = gate.acquire();
    assert.equal(second, 2);
    assert.equal(gate.isActive(first!), false);
    gate.cancel();
    assert.equal(gate.isActive(second!), false);
  });

  it("confirms before starting and never downgrades a failed bound attempt", async () => {
    const gate = createVoiceNoteAttemptGate();
    const order: string[] = [];
    const bound = await beginVoiceNoteAttempt({
      gate,
      prepare: async () => { order.push("confirmed-pause"); return { positionMillis: 44 }; },
    });
    order.push("native-recording-start");
    assert.deepEqual(order, ["confirmed-pause", "native-recording-start"]);
    gate.release(bound!.id);
    await assert.rejects(beginVoiceNoteAttempt({
      gate,
      prepare: async () => { throw new Error("binding expired"); },
    }));
    assert.equal(gate.acquire(), 3);
  });
});
