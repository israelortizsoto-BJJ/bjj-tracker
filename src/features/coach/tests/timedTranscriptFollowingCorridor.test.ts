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
 * Film Room Evidence Consumption v1 — first production TimedTranscript consumer:
 * Transcript Following (Session playhead → active segment highlight).
 */
describe("TimedTranscript Following — production Film Room consumer (source)", () => {
  const following = source("src/features/coach/TimedTranscriptFollowing.tsx");
  const resolve = source("src/media/resolveActiveTimedTranscriptSegment.ts");
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");

  it("exposes TimedTranscriptFollowing that loads via readTimedTranscript", () => {
    assert.match(following, /export function TimedTranscriptFollowing/);
    assert.match(following, /readTimedTranscript/);
    assert.match(following, /resolveActiveTimedTranscriptSegment/);
    assert.match(following, /from "\.\.\/\.\.\/media\/readTimedTranscript"/);
  });

  it("highlights the active segment from currentTimeMs (Following)", () => {
    assert.match(following, /currentTimeMs/);
    assert.match(following, /activeSegment/);
    assert.match(following, /resolveActiveTimedTranscriptSegment\(transcript\.segments, currentTimeMs\)/);
    assert.match(following, /active \? styles\.activeText : null/);
    assert.match(following, /activeText:[\s\S]*fontWeight: "700"/);
  });

  it("notifies active segment changes for closed-caption consumers", () => {
    assert.match(following, /onActiveSegmentChange/);
    assert.match(following, /lastNotifiedIdRef/);
  });

  it("does not import Session, PlaybackCoordinator, seek, Parent, or sync", () => {
    for (const src of [following, resolve]) {
      assert.doesNotMatch(src, /from ["'].*PlaybackCoordinator/);
      assert.doesNotMatch(src, /from ["'].*FilmRoomSessionCoordinator/);
      assert.doesNotMatch(src, /requestSeek/);
      assert.doesNotMatch(src, /coach-sync-worker/);
      assert.doesNotMatch(src, /MatchCard/);
    }
    assert.doesNotMatch(following, /getPlayhead/);
  });

  it("MatchBlock wires Following from session playhead gated to coach_audio", () => {
    assert.match(matchEditor, /TimedTranscriptFollowing/);
    assert.match(matchEditor, /from "\.\.\/coach\/TimedTranscriptFollowing"/);
    assert.match(matchEditor, /transcriptFollowTimeMs/);
    assert.match(matchEditor, /getActiveParticipant\(\)/);
    assert.match(matchEditor, /active === coachAudioCoordinator/);
    assert.match(matchEditor, /setTranscriptFollowTimeMs\(playhead\.currentTimeMs\)/);
    assert.match(matchEditor, /currentTimeMs=\{transcriptFollowTimeMs\}/);
    assert.match(matchEditor, /audioUri=\{match\.voiceNoteRefs/);
  });

  it("Following remains a production surface (not __DEV__-gated)", () => {
    assert.doesNotMatch(following, /if \(!__DEV__\) return null/);
    assert.doesNotMatch(matchEditor, /__DEV__ \? <TimedTranscriptFollowing/);
  });
});
