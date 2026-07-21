import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

/**
 * Film Room Phase 1 — Evidence Domain Activation: TimedTranscript READ corridor.
 * Proves persist + read + schema validation without Following / Session / UI / runtime.
 */
describe("TimedTranscript Evidence Domain — READ corridor (source)", () => {
  const timedTypes = source("src/types/timedTranscript.ts");
  const persistTimed = source("src/media/persistTimedTranscript.ts");
  const readTimed = source("src/media/readTimedTranscript.ts");

  it("exposes parseTimedTranscript schema validation that returns null safely", () => {
    assert.match(timedTypes, /export function parseTimedTranscript/);
    assert.match(timedTypes, /Returns null for any schema violation/);
    assert.match(timedTypes, /TIMED_TRANSCRIPT_VERSION/);
    assert.match(timedTypes, /TIMED_TRANSCRIPT_SOURCE_WHISPER/);
  });

  it("exposes readTimedTranscript(audioUri) → TimedTranscript | null", () => {
    assert.match(readTimed, /export async function readTimedTranscript/);
    assert.match(readTimed, /Promise<TimedTranscript \| null>/);
    assert.match(readTimed, /parseTimedTranscript/);
    assert.match(readTimed, /coachTimedTranscriptJsonUriForAudioUri/);
    assert.match(readTimed, /return null/);
  });

  it("shares audio-reference keying between persist and read", () => {
    assert.match(persistTimed, /export function coachTimedTranscriptJsonUriForAudioUri/);
    assert.match(persistTimed, /media\/coach-timed-transcript\//);
    assert.match(persistTimed, /\.timed-transcript\.json/);
    assert.match(readTimed, /from "\.\/persistTimedTranscript"/);
  });

  it("READ corridor does not import Session, runtime, worker, or overlay surfaces", () => {
    for (const src of [readTimed, persistTimed, timedTypes]) {
      assert.doesNotMatch(src, /PlaybackCoordinator/);
      assert.doesNotMatch(src, /FilmRoomSessionCoordinator/);
      assert.doesNotMatch(src, /getPlayhead|requestSeek/);
      assert.doesNotMatch(src, /coach-sync-worker/);
      assert.doesNotMatch(src, /coachMatchBreakdownOverlay/);
      assert.doesNotMatch(src, /from ["'].*mediaRuntime/);
    }
  });
});
