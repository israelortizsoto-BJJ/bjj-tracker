import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { extractCoachCommentaryMediaMetadata } from "../../../domain/competition/extractCoachCommentaryMediaMetadata.ts";
import { parseCoachMatchBreakdownArtifactsField } from "../../../services/coachMatchBreakdownArtifactParser.ts";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "../../../domain/competition/mergeCoachBreakdownIntoMatches.ts";
import type { CoachMatchBreakdownOverlay } from "../../../types/coachMatchBreakdownOverlay.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Coach Commentary media metadata corridor", () => {
  const syncTypes = source("src/types/coachWeeklySync.ts");
  const builder = source("src/domain/competition/buildCoachMatchBreakdownArtifacts.ts");
  const publish = source("src/domain/competition/publishCoachMatchBreakdownArtifacts.ts");
  const worker = source("coach-sync-worker/src/index.ts");
  const wrangler = source("coach-sync-worker/wrangler.toml");
  const matchCard = source("src/features/competition/MatchCard.tsx");
  const filmRoomCommentary = source(
    "src/features/filmRoom/FilmRoomCoachCommentaryControls.tsx",
  );
  const mediaApi = source("src/services/coachMediaApi.ts");
  const route = source("app/competition/film-room.tsx");
  const filmRoom = source("src/features/filmRoom/FilmRoomScreen.tsx");

  it("sync artifact may carry mediaId/durationMs/mimeType but never URL fields", () => {
    assert.match(syncTypes, /mediaId\?: string;/);
    assert.match(syncTypes, /durationMs\?: number;/);
    assert.match(syncTypes, /mimeType\?: string;/);
    assert.doesNotMatch(syncTypes, /audioUrl\?:|localUri\?:|voiceNoteRefs\?:/);
    assert.match(syncTypes, /schemaVersion: 1 \| 2/);
    assert.match(syncTypes, /normalizeCoachMatchBreakdownAlignment/);
  });

  it("builder publishes media metadata via extract helper without embedding voiceNoteRefs", () => {
    assert.match(builder, /extractCoachCommentaryMediaMetadata/);
    assert.doesNotMatch(builder, /voiceNoteRefs/);
    assert.doesNotMatch(builder, /localUri/);
    assert.match(builder, /schemaVersion: artifacts\.some\(\(artifact\) => artifact\.alignment\) \? 2 : 1/);
  });

  it("publish uploads best-effort before artifact build and never blocks on failure", () => {
    assert.match(publish, /bestEffortUploadCoachCommentaryMedia/);
    const uploadIdx = publish.indexOf("bestEffortUploadCoachCommentaryMedia");
    const buildIdx = publish.indexOf("buildCoachMatchBreakdownArtifacts");
    assert.ok(uploadIdx > 0 && buildIdx > uploadIdx);
  });

  it("worker exposes R2-backed upload + resolve + signed content routes", () => {
    assert.match(wrangler, /binding = "MEDIA"/);
    assert.match(worker, /MEDIA: R2Bucket/);
    assert.match(worker, /const mediaUpload = path\.match/);
    assert.match(worker, /const mediaResolve = path\.match/);
    assert.match(worker, /const mediaContent = path\.match/);
    assert.match(worker, /\/content\$/);
    assert.match(worker, /signMediaContentAccess/);
    assert.match(worker, /if \("voiceNoteRefs" in o\) return null;/);
  });

  it("client resolves mediaId to ephemeral URL and never stores URL in artifact helpers", () => {
    assert.match(mediaApi, /coachSyncResolveCoachMedia/);
    assert.match(mediaApi, /never write it into the Match Breakdown artifact/);
    // PD-FR-001: Match Card Watch CTA launches Film Room; resolve lives on Film Room controls.
    assert.match(matchCard, /Watch Coach Match Breakdown/);
    assert.match(matchCard, /\/competition\/film-room/);
    assert.doesNotMatch(matchCard, /coachSyncResolveCoachMedia/);
    assert.doesNotMatch(matchCard, /localUri/);
    assert.match(filmRoomCommentary, /coachSyncResolveCoachMedia/);
  });

  it("extractCoachCommentaryMediaMetadata returns mediaId only when present", () => {
    const overlay: CoachMatchBreakdownOverlay = {
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
      matchLineageKey: "match_1",
      coachNote: "Keep the underhook.",
      voiceNoteRefs: [
        {
          id: "voice-1",
          localUri: "file:///tmp/note.m4a",
          createdAt: "2026-07-18T00:00:00.000Z",
          mimeType: "audio/mp4",
          durationMs: 42000,
          mediaId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          alignment: {
            commentaryStartVideoMs: 1200,
            matchMediaAssetId: "shared-asset-1",
            attachmentRevision: 2,
          },
        },
      ],
      updatedAt: "2026-07-18T00:00:00.000Z",
    };
    const media = extractCoachCommentaryMediaMetadata(overlay);
    assert.deepEqual(media, {
      mediaId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      durationMs: 42000,
      mimeType: "audio/mp4",
      alignment: {
        commentaryStartVideoMs: 1200,
        matchMediaAssetId: "shared-asset-1",
        attachmentRevision: 2,
      },
    });
    assert.equal(
      extractCoachCommentaryMediaMetadata({
        ...overlay,
        voiceNoteRefs: [
          {
            id: "voice-1",
            localUri: "file:///tmp/note.m4a",
            createdAt: "2026-07-18T00:00:00.000Z",
          },
        ],
      }),
      null,
    );
  });

  it("parser accepts media metadata and rejects localUri/url payloads", () => {
    const valid = parseCoachMatchBreakdownArtifactsField({
      ath_1: {
        schemaVersion: 1,
        sharedAthleteId: "ath_1",
        updatedAt: "2026-07-18T00:00:00.000Z",
        artifacts: [
          {
            sharedAthleteId: "ath_1",
            sharedCompetitionId: "comp_1",
            matchLineageKey: "match_1",
            coachNote: "Keep pressure.",
            mediaId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            durationMs: 12000,
            mimeType: "audio/mp4",
            updatedAt: "2026-07-18T00:00:00.000Z",
          },
        ],
      },
    });
    assert.equal(valid.evidence.fieldClassification, "valid");
    assert.equal(
      valid.artifactsByAthleteId.ath_1?.artifacts[0]?.mediaId,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const rejected = parseCoachMatchBreakdownArtifactsField({
      ath_1: {
        schemaVersion: 1,
        sharedAthleteId: "ath_1",
        updatedAt: "2026-07-18T00:00:00.000Z",
        artifacts: [
          {
            sharedAthleteId: "ath_1",
            sharedCompetitionId: "comp_1",
            matchLineageKey: "match_1",
            coachNote: "Keep pressure.",
            localUri: "file:///tmp/bad.m4a",
            updatedAt: "2026-07-18T00:00:00.000Z",
          },
        ],
      },
    });
    assert.equal(rejected.evidence.fieldClassification, "malformed");
  });

  it("preserves complete v2 alignment but drops partial or malformed alignment alone", () => {
    const base = {
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
      matchLineageKey: "match_1",
      coachNote: "Keep pressure.",
      mediaId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      durationMs: 12000,
      mimeType: "audio/mp4",
      updatedAt: "2026-07-18T00:00:00.000Z",
    };
    const parse = (alignment: unknown) =>
      parseCoachMatchBreakdownArtifactsField({
        ath_1: {
          schemaVersion: 2,
          sharedAthleteId: "ath_1",
          updatedAt: base.updatedAt,
          artifacts: [{ ...base, alignment }],
        },
      }).artifactsByAthleteId.ath_1?.artifacts[0];
    assert.deepEqual(parse({ commentaryStartVideoMs: 0, matchMediaAssetId: " asset ", attachmentRevision: 1 })?.alignment, {
      commentaryStartVideoMs: 0,
      matchMediaAssetId: "asset",
      attachmentRevision: 1,
    });
    const malformed = parse({ commentaryStartVideoMs: -1, matchMediaAssetId: "asset" });
    assert.equal(malformed?.alignment, undefined);
    assert.equal(malformed?.coachNote, base.coachNote);
    assert.equal(malformed?.mediaId, base.mediaId);
    assert.equal(malformed?.durationMs, base.durationMs);
    assert.equal(malformed?.mimeType, base.mimeType);
  });

  it("Worker reconstructs v2 alignment while excluding local and playable media fields", () => {
    assert.match(worker, /o\.schemaVersion !== 1 && o\.schemaVersion !== 2/);
    assert.match(worker, /commentaryStartVideoMs/);
    assert.match(worker, /matchMediaAssetId/);
    assert.match(worker, /attachmentRevision/);
    assert.match(worker, /typeof o\.playableUri === "string"/);
    assert.match(worker, /"voiceNoteRefs" in o/);
  });

  it("hydrates the complete alignment through the parent match snapshot and Film Room props only", () => {
    const artifactSet = {
      schemaVersion: 2 as const,
      sharedAthleteId: "ath_1",
      updatedAt: "2026-07-18T00:00:00.000Z",
      artifacts: [{
        sharedAthleteId: "ath_1",
        sharedCompetitionId: "comp_1",
        matchLineageKey: "match_1",
        coachNote: "Keep pressure.",
        mediaId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        updatedAt: "2026-07-18T00:00:00.000Z",
        alignment: { commentaryStartVideoMs: 1200, matchMediaAssetId: "asset-1", attachmentRevision: 3 },
      }],
    };
    const annotations = overlayAnnotationsFromCoachMatchBreakdownArtifactSet({
      artifactSet,
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
      matchLineageKeys: ["match_1"],
    });
    const merged = mergeCoachBreakdownIntoMatches({
      matches: [{ id: "match_1", matchResult: "win", outcome: null, submissionTime: null, imageUri: null, videoUri: null, imageAssetId: null, videoAssetId: null }],
      overlayAnnotations: annotations,
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
    });
    assert.deepEqual(merged[0]?.alignment, artifactSet.artifacts[0]?.alignment);
    assert.match(route, /commentaryStartVideoMs/);
    assert.match(route, /alignment=\{alignment\}/);
    assert.match(filmRoom, /alignment: _alignment/);
    assert.doesNotMatch(filmRoom, /seekAsync\([^)]*_alignment|playAsync\([^)]*_alignment/);
  });
});
