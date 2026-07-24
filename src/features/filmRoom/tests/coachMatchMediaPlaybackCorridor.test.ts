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
 * Coach Shared Match Media → Film Room playback corridor (source proof).
 *
 * hydrated attachment → on-demand resolve → memory-only URI → FilmRoomScreen
 */
describe("Coach Match Media Film Room playback corridor (source)", () => {
  const matchCard = source("src/features/competition/MatchCard.tsx");
  const route = source("app/competition/film-room.tsx");
  const hook = source("src/features/filmRoom/useCoachMatchMediaPlaybackUri.ts");
  const resolveCore = source("src/features/filmRoom/coachMatchMediaPlaybackResolve.ts");
  const sessionTarget = source("src/services/resolveCoachMatchMediaSessionTarget.ts");
  const filmRoom = source("src/features/filmRoom/FilmRoomScreen.tsx");
  const video = source("src/features/filmRoom/FilmRoomVideoPlayer.tsx");
  const resolutionApi = source("src/services/coachMatchMediaResolutionApi.ts");
  const attachmentStore = source("src/storage/coachMatchMediaAttachmentStore.ts");

  it("MatchCard gates Film Room on attached projection only (not mediaId alone)", () => {
    assert.match(matchCard, /canOpenFilmRoom = Boolean\(attachedMatchMedia\)/);
    assert.doesNotMatch(matchCard, /canOpenFilmRoom = Boolean\(mediaId\s*\|\|/);
    assert.match(matchCard, /matchMediaAttachment\?\.state === "attached"/);
    assert.match(matchCard, /matchMediaAttachment\?\.state === "tombstoned"/);
    assert.match(matchCard, /Video removed/);
    // mediaId remains identity for voice commentary — never opens this corridor alone.
    assert.match(matchCard, /const mediaId = snapshot\.mediaId/);
  });

  it("MatchCard does not call resolution and passes identity only", () => {
    assert.doesNotMatch(matchCard, /coachSyncResolveMatchMediaAttachment/);
    assert.doesNotMatch(matchCard, /resolveCoachMatchMediaSessionTarget/);
    assert.doesNotMatch(matchCard, /useCoachMatchMediaPlaybackUri/);
    assert.match(matchCard, /getCoachMatchMediaAttachment/);
    assert.match(matchCard, /matchMediaAssetId/);
    assert.match(matchCard, /expectedRevision/);
    assert.match(matchCard, /buildFilmRoomHref/);
    // Signed URL / secret / object key must never enter navigation.
    assert.doesNotMatch(matchCard, /params\.set\("videoUri".*matchMedia/);
    assert.doesNotMatch(matchCard, /writerSecret/);
    assert.doesNotMatch(matchCard, /objectKey|storageObjectKey/);
  });

  it("route/bridge resolves upstream and wires delivery failure to the hook", () => {
    assert.match(route, /useCoachMatchMediaPlaybackUri/);
    assert.match(route, /parseCoachMatchMediaPlaybackIdentity/);
    assert.match(route, /FilmRoomScreen/);
    assert.match(route, /matchMediaAssetId/);
    assert.match(route, /expectedRevision/);
    assert.match(route, /Retry/);
    assert.match(route, /Video removed/);
    assert.match(route, /Video unavailable/);
    assert.match(route, /onDeliveryError/);
    assert.match(route, /playback\.reportDeliveryFailure/);
    assert.doesNotMatch(route, /coachSyncResolveMatchMediaAttachment/);
    assert.doesNotMatch(filmRoom, /coachSyncResolveMatchMediaAttachment/);
    assert.doesNotMatch(filmRoom, /useCoachMatchMediaPlaybackUri/);
    assert.doesNotMatch(video, /coachSyncResolveMatchMediaAttachment/);
  });

  it("FilmRoomVideoPlayer exposes a narrow delivery-error callback via expo-av", () => {
    assert.match(video, /onDeliveryError\?/);
    assert.match(video, /onError=\{/);
    assert.match(video, /emitDeliveryError/);
    assert.match(video, /classifyCoachMatchMediaPlayerDeliveryError/);
    assert.match(video, /deliveryErrorReportedRef/);
    assert.doesNotMatch(video, /resolveCoachMatchMediaPlaybackOnce/);
    assert.doesNotMatch(video, /reportDeliveryFailure/);
    assert.doesNotMatch(video, /coachSyncResolveMatchMediaAttachment/);
  });

  it("FilmRoomScreen forwards delivery failure without owning resolution", () => {
    assert.match(filmRoom, /onDeliveryError\?/);
    assert.match(filmRoom, /onDeliveryError=\{onDeliveryError\}/);
    assert.doesNotMatch(filmRoom, /reportDeliveryFailure/);
    assert.doesNotMatch(filmRoom, /resolveCoachMatchMediaPlaybackOnce/);
    assert.doesNotMatch(filmRoom, /resolveCoachMatchMediaSessionTarget/);
    assert.doesNotMatch(filmRoom, /coachSyncResolveMatchMediaAttachment/);
  });

  it("hook resolves with full identity + expectedRevision and keeps URL memory-only", () => {
    assert.match(resolveCore, /resolveAttachment/);
    assert.match(resolveCore, /resolveSessionTarget/);
    assert.match(resolveCore, /expectedRevision/);
    assert.match(resolveCore, /sharedAthleteId/);
    assert.match(resolveCore, /sharedCompetitionId/);
    assert.match(resolveCore, /matchLineageKey/);
    assert.match(resolveCore, /matchMediaAssetId/);
    assert.match(resolveCore, /getAttachment/);
    assert.match(resolveCore, /decideCoachMatchMediaDeliveryFailure/);
    assert.match(hook, /coachSyncResolveMatchMediaAttachment/);
    assert.match(hook, /resolveCoachMatchMediaSessionTarget/);
    assert.match(hook, /getCoachMatchMediaAttachment/);
    assert.match(hook, /resolveCoachMatchMediaPlaybackOnce/);
    assert.match(hook, /reportDeliveryFailure/);
    assert.match(hook, /decideCoachMatchMediaDeliveryFailure/);
    assert.match(hook, /retry/);
    for (const src of [hook, resolveCore]) {
      assert.doesNotMatch(src, /AsyncStorage/);
      assert.doesNotMatch(src, /\.setItem\s*\(/);
      assert.doesNotMatch(src, /console\.log\([^\)]*url/);
      assert.doesNotMatch(src, /console\.log\([^\)]*expiresAt/);
      assert.doesNotMatch(src, /storageObjectKey|objectKey/);
    }
    assert.match(resolveCore, /tombstoned/);
  });

  it("session target supplies writer credentials without inventing delivery state", () => {
    assert.match(sessionTarget, /coachWriterSecret/);
    assert.match(sessionTarget, /linkToken/);
    assert.match(sessionTarget, /dedupeActiveCoachWriterLinks/);
    assert.doesNotMatch(sessionTarget, /AsyncStorage/);
    assert.doesNotMatch(sessionTarget, /coachSyncResolveMatchMediaAttachment/);
  });

  it("reuses certified resolution API, attachment store, and Film Room session owners", () => {
    assert.match(resolutionApi, /export async function coachSyncResolveMatchMediaAttachment/);
    assert.match(attachmentStore, /export async function getCoachMatchMediaAttachment/);
    assert.match(filmRoom, /FilmRoomVideoPlayer/);
    assert.match(filmRoom, /createFilmRoomSessionCoordinator/);
    assert.match(video, /createPlaybackCoordinator/);
    assert.doesNotMatch(filmRoom, /resolveCoachMatchMediaSessionTarget/);
    // PlaybackCoordinator / FilmRoomSessionCoordinator remain unchanged owners.
    assert.doesNotMatch(hook, /createFilmRoomSessionCoordinator|createPlaybackCoordinator/);
    assert.doesNotMatch(resolveCore, /createFilmRoomSessionCoordinator|createPlaybackCoordinator/);
  });

  it("preserves voice Match Breakdown identity on the same matchLineageKey corridor", () => {
    assert.match(matchCard, /matchLineageKey: snapshot\.id/);
    assert.match(filmRoom, /sharedAthleteId/);
    assert.match(filmRoom, /sharedCompetitionId/);
    assert.match(filmRoom, /matchLineageKey/);
    assert.match(filmRoom, /FilmRoomCoachCommentaryControls/);
    assert.doesNotMatch(hook, /persistCoachVoiceAudio|CoachVoiceNoteField|playhead/);
    assert.doesNotMatch(resolveCore, /persistCoachVoiceAudio|CoachVoiceNoteField/);
    assert.match(route, /alignment=\{alignment\}/);
    assert.match(filmRoom, /alignment: _alignment/);
    // Alignment is receive-only transport: it must not become a playback instruction.
    assert.doesNotMatch(filmRoom, /seekAsync\([^)]*_alignment|playAsync\([^)]*_alignment|pauseAsync\([^)]*_alignment/);
  });

  it("never routes, persists, caches, or logs signed URL / signature / object key", () => {
    for (const src of [matchCard, route, filmRoom, video, hook, resolveCore]) {
      assert.doesNotMatch(src, /params\.set\(["']url["']/);
      assert.doesNotMatch(src, /params\.set\(["']signature["']/);
      assert.doesNotMatch(src, /AsyncStorage/);
      assert.doesNotMatch(src, /storageObjectKey/);
    }
    assert.doesNotMatch(route, /params\.set\(["']videoUri["']/);
    assert.doesNotMatch(matchCard, /console\.log\([^\)]*url/);
    assert.doesNotMatch(hook, /console\.log/);
    assert.doesNotMatch(resolveCore, /console\.log/);
    assert.doesNotMatch(video, /console\.log/);
  });
});
