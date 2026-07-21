import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Coach Match Breakdown single-clock authority (source)", () => {
  const filmRoom = source("src/features/filmRoom/FilmRoomScreen.tsx");
  const video = source("src/features/filmRoom/FilmRoomVideoPlayer.tsx");
  const commentary = source("src/features/filmRoom/FilmRoomCoachCommentaryControls.tsx");

  it("routes green play through the video-led product command", () => {
    assert.match(commentary, /await onPlay\(playbackRef\.current\)/);
    assert.doesNotMatch(commentary, /await playbackRef\.current\.play\(\)/);
    assert.match(filmRoom, /const playCoachMatchBreakdown = useCallback/);
    assert.match(filmRoom, /await videoCoordinator\.play\(\)/);
    assert.match(filmRoom, /await audioFollower\.play\(\)/);
  });

  it("never registers coach audio as a Session authority", () => {
    assert.match(filmRoom, /session\.register\(videoCoordinator, "video"\)/);
    assert.doesNotMatch(filmRoom, /session\.register\(coachAudioCoordinator, "coach_audio"\)/);
    assert.doesNotMatch(filmRoom, /active === coachAudioCoordinator/);
  });

  it("converges video and green controls on the same command", () => {
    assert.match(video, /onPlay: \(\) => void \| Promise<void>/);
    assert.match(video, /\? onPause\(\)[\s\S]*: onPlay\(\)/);
    assert.match(filmRoom, /<FilmRoomVideoPlayer[\s\S]*onPlay=\{playCoachMatchBreakdown\}/);
    assert.match(filmRoom, /<FilmRoomCoachCommentaryControls[\s\S]*onPlay=\{playCoachMatchBreakdown\}/);
    assert.match(filmRoom, /onPause=\{pauseCoachMatchBreakdown\}/);
  });

  it("aligns audio as a follower before native video-led playback", () => {
    const playCommand = filmRoom.slice(
      filmRoom.indexOf("const playCoachMatchBreakdown"),
      filmRoom.indexOf("const pauseCoachMatchBreakdown"),
    );
    assert.match(playCommand, /session\.getPlayhead\(\)\.currentTimeMs/);
    assert.match(playCommand, /audioFollower\.seek\(startTimeMs\)/);
    assert.ok(
      playCommand.indexOf("videoCoordinator.play()") <
        playCommand.indexOf("audioFollower.play()"),
    );
  });

  it("feeds transcript from video-led Session time", () => {
    assert.match(filmRoom, /active === videoCoordinator/);
    assert.match(filmRoom, /setTranscriptFollowTimeMs\(playhead\.currentTimeMs\)/);
    assert.match(filmRoom, /videoCoordinator=\{videoCoordinator\}/);
  });

  it("prevents audio status callbacks from seeking video", () => {
    assert.match(commentary, /applyAudioStatus\(status\)/);
    assert.doesNotMatch(commentary, /FilmRoomSessionCoordinator/);
    assert.doesNotMatch(commentary, /videoCoordinator/);
    assert.doesNotMatch(commentary, /requestSeek/);
  });

  it("routes replay through Session seek authority", () => {
    assert.match(filmRoom, /const replayCoachMatchBreakdown = useCallback/);
    assert.match(filmRoom, /await session\.requestSeek\(0\)/);
    assert.match(video, /void onReplay\(\)/);
    assert.doesNotMatch(video, /playbackRef\.current\.replay\(\)/);
  });

  it("keeps match audio muted", () => {
    assert.match(video, /\bisMuted\b/);
  });

  it("degrades safely for missing commentary or video", () => {
    assert.match(filmRoom, /if \(!hasVideo \|\| !videoCoordinator\) return/);
    assert.match(commentary, /!coordinatedPlaybackAvailable/);
    assert.match(commentary, /Match video unavailable/);
    assert.match(filmRoom, /if \(coachAudioCoordinator\)/);
  });
});
