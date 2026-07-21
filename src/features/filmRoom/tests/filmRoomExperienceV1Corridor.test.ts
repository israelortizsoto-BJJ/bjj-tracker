import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

/**
 * Coach Match Breakdown Experience v2 — premium media composition.
 *
 * Competition → Match Card → "▶ Watch Coach Match Breakdown" → FilmRoomScreen.
 */
describe("Coach Match Breakdown Experience v2 — premium media composition (source)", () => {
  const matchCard = source("src/features/competition/MatchCard.tsx");
  const filmRoom = source("src/features/filmRoom/FilmRoomScreen.tsx");
  const video = source("src/features/filmRoom/FilmRoomVideoPlayer.tsx");
  const commentary = source("src/features/filmRoom/FilmRoomCoachCommentaryControls.tsx");
  const following = source("src/features/coach/TimedTranscriptFollowing.tsx");
  const route = source("app/competition/film-room.tsx");

  it("PD-FR-001: Match Card CTA navigates to Film Room (no inline session)", () => {
    assert.match(matchCard, /Watch Coach Match Breakdown/);
    assert.match(matchCard, /buildFilmRoomHref/);
    assert.match(matchCard, /\/competition\/film-room/);
    assert.match(matchCard, /router\.push/);
    assert.doesNotMatch(matchCard, /Listen to Coach Commentary/);
    assert.doesNotMatch(matchCard, /from ["'].*FilmRoomSessionCoordinator/);
    assert.doesNotMatch(matchCard, /createPlaybackCoordinator/);
    assert.doesNotMatch(matchCard, /coachSyncResolveCoachMedia/);
    assert.doesNotMatch(matchCard, /localUri/);
  });

  it("FilmRoomScreen composes video + commentary + TimedTranscript + coachNote", () => {
    assert.match(filmRoom, /FilmRoomVideoPlayer/);
    assert.match(filmRoom, /FilmRoomCoachCommentaryControls/);
    assert.match(filmRoom, /TimedTranscriptFollowing/);
    assert.match(filmRoom, /COACH INTERPRETATION/);
    assert.match(filmRoom, /Read More/);
    assert.match(route, /FilmRoomScreen/);
  });

  it("presents the canonical media-first hierarchy", () => {
    const videoPosition = filmRoom.indexOf("<FilmRoomVideoPlayer");
    const commentaryPosition = filmRoom.indexOf("<FilmRoomCoachCommentaryControls");
    const transcriptPosition = filmRoom.indexOf("<FilmRoomTranscriptFollowBridge");
    const interpretationPosition = filmRoom.indexOf("COACH INTERPRETATION");
    assert.ok(videoPosition < commentaryPosition);
    assert.ok(commentaryPosition < transcriptPosition);
    assert.ok(transcriptPosition < interpretationPosition);
    assert.match(filmRoom, /Coach Match Breakdown/);
    assert.match(filmRoom, /FILM ROOM/);
  });

  it("Film Room Session has one continuous leader and transcript follows it", () => {
    assert.match(filmRoom, /createFilmRoomSessionCoordinator/);
    assert.match(filmRoom, /session\.register\(videoCoordinator, "video"\)/);
    assert.doesNotMatch(filmRoom, /session\.register\(coachAudioCoordinator, "coach_audio"\)/);
    assert.match(filmRoom, /getPlayhead\(\)/);
    assert.match(filmRoom, /getActiveParticipant\(\)/);
    assert.match(filmRoom, /active === videoCoordinator/);
    assert.match(filmRoom, /setTranscriptFollowTimeMs\(playhead\.currentTimeMs\)/);
    assert.match(filmRoom, /requestSeek\(0\)/);
  });

  it("P1: match video is muted by default (coach narration primary)", () => {
    assert.match(video, /\bisMuted\b/);
  });

  it("P2: playhead poll is isolated from Video (memo + bridge)", () => {
    assert.match(video, /memo\(function FilmRoomVideoPlayer/);
    assert.match(filmRoom, /FilmRoomTranscriptFollowBridge/);
    assert.match(filmRoom, /setInterval\(syncFromSessionPlayhead, 250\)/);
  });

  it("P3: closed-caption overlay reuses TimedTranscriptFollowing active segment", () => {
    assert.match(following, /onActiveSegmentChange/);
    assert.match(filmRoom, /onActiveSegmentChange/);
    assert.match(filmRoom, /captionText/);
    assert.match(video, /captionText/);
    assert.match(video, /captionWrap/);
  });

  it("P4: video presentation — capped height + auto-hiding controls", () => {
    assert.match(video, /VIDEO_MAX_HEIGHT_RATIO/);
    assert.match(video, /controlsVisible/);
    assert.match(video, /CONTROLS_HIDE_MS/);
  });

  it("uses media controls and native caption styling instead of editor controls", () => {
    assert.match(video, /primaryControl/);
    assert.match(video, /controlsOverlay/);
    assert.match(video, /captionBg/);
    assert.match(video, /Show video controls/);
    assert.doesNotMatch(video, /controlText/);
    assert.doesNotMatch(video, />▶ Play</);
  });

  it("renders narration as now-playing media and transcript as dark supporting content", () => {
    assert.match(commentary, /ACTIVE COACH BREAKDOWN/);
    assert.match(commentary, /nowPlaying/);
    assert.match(commentary, /Coach is talking/);
    assert.match(following, /Follow the breakdown/);
    assert.match(following, /activeMark/);
    assert.doesNotMatch(following, /#f9fafb/);
    assert.doesNotMatch(following, /#eff6ff/);
  });

  it("reuses certified field coordinators and media resolve corridor", () => {
    assert.match(video, /createPlaybackCoordinator/);
    assert.match(video, /createVideoAdapter/);
    assert.match(commentary, /createPlaybackCoordinator/);
    assert.match(commentary, /createAudioAdapter/);
    assert.match(commentary, /coachSyncResolveCoachMedia/);
    assert.match(commentary, /resolveCoachMediaSessionTarget/);
  });

  it("does not implement Teaching Moments, chapters, waveforms, or editing", () => {
    for (const src of [filmRoom, video, commentary, matchCard]) {
      assert.doesNotMatch(src, /TeachingMoment/);
      assert.doesNotMatch(src, /Waveform/);
      assert.doesNotMatch(src, /Chapter/);
      assert.doesNotMatch(src, /onCoachNoteChange/);
    }
  });
});
