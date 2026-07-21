import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

/**
 * Film Room Evidence Activation — first TimedTranscript consumer:
 * developer-facing read-only inspector (not Following / playback sync).
 */
describe("TimedTranscript Inspector — first consumer (source)", () => {
  const inspector = source("src/features/coach/TimedTranscriptInspector.tsx");
  const voiceField = source("src/features/coach/CoachVoiceNoteField.tsx");

  it("exposes TimedTranscriptInspector that loads via readTimedTranscript", () => {
    assert.match(inspector, /export function TimedTranscriptInspector/);
    assert.match(inspector, /readTimedTranscript/);
    assert.match(inspector, /from "\.\.\/\.\.\/media\/readTimedTranscript"/);
  });

  it("renders segment index, startMs, endMs, and text (read-only)", () => {
    assert.match(inspector, /segments\.map/);
    assert.match(inspector, /\[\{index\}\]/);
    assert.match(inspector, /segment\.startMs/);
    assert.match(inspector, /segment\.endMs/);
    assert.match(inspector, /segment\.text/);
    assert.doesNotMatch(inspector, /requestSeek|getPlayhead|onSeek|highlight|Transcript Following/i);
  });

  it("is developer-facing only (__DEV__)", () => {
    assert.match(inspector, /if \(!__DEV__\) return null/);
    assert.match(voiceField, /TimedTranscriptInspector/);
    assert.match(voiceField, /__DEV__ \? <TimedTranscriptInspector audioUri=\{playbackUri\}/);
  });

  it("does not import Session, runtime, worker, Parent, or sync surfaces", () => {
    for (const src of [inspector]) {
      assert.doesNotMatch(src, /PlaybackCoordinator/);
      assert.doesNotMatch(src, /FilmRoomSessionCoordinator/);
      assert.doesNotMatch(src, /getPlayhead|requestSeek/);
      assert.doesNotMatch(src, /coach-sync-worker/);
      assert.doesNotMatch(src, /from ["'].*mediaRuntime/);
      assert.doesNotMatch(src, /onChangeText/);
    }
  });
});
