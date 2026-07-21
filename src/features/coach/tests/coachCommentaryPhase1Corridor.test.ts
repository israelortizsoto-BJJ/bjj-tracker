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
 * Phase 1 Coach Commentary certification (coach-device only).
 * Proves the persistence corridor without sync, blobs, or parent playback.
 */
describe("Coach Commentary Phase 1 — coach-device persistence corridor (source)", () => {
  const voiceField = source("src/features/coach/CoachVoiceNoteField.tsx");
  const persistVoice = source("src/media/persistCoachVoiceAudio.ts");
  const overlayTypes = source("src/types/coachMatchBreakdownOverlay.ts");
  const overlayStore = source("src/storage/coachMatchBreakdownOverlayStore.ts");
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");
  const coachEdit = source("app/(tabs)/coach/kid/[kidId]/competition/edit.tsx");
  const projection = source("src/domain/competition/projectCompetitionCompeteView.ts");
  const artifacts = source("src/domain/competition/buildCoachMatchBreakdownArtifacts.ts");
  const worker = source("coach-sync-worker/src/index.ts");

  it("CC-001: CoachVoiceNoteField persists local audio via the shared media helper", () => {
    assert.match(persistVoice, /persistCoachVoiceAudio/);
    assert.match(persistVoice, /media\/coach-voice\//);
    assert.match(voiceField, /persistCoachVoiceAudio/);
    assert.match(voiceField, /onAudioPersisted/);
    assert.match(voiceField, /audio_persisted_locally/);
    assert.match(voiceField, /transcribeCoachAudio/);
  });

  it("CC-001: missing audio persist never blocks transcription corridor", () => {
    assert.match(voiceField, /audio_persist_failed/);
    const persistFailIdx = voiceField.indexOf("audio_persist_failed");
    const transcribeIdx = voiceField.indexOf("transcribeCoachAudio(uri)");
    assert.ok(persistFailIdx > 0 && transcribeIdx > persistFailIdx);
  });

  it("Timed Transcript Phase A: local evidence persist never blocks coachNote", () => {
    const persistTimed = source("src/media/persistTimedTranscript.ts");
    const timedTypes = source("src/types/timedTranscript.ts");
    const transcription = source("src/features/coach/coachVoiceTranscription.ts");

    assert.match(timedTypes, /export type TimedTranscript/);
    assert.match(timedTypes, /export type TimedTranscriptSegment/);
    assert.match(timedTypes, /export function parseTimedTranscript/);
    assert.match(persistTimed, /media\/coach-timed-transcript\//);
    assert.match(persistTimed, /persistTimedTranscript/);
    assert.match(transcription, /verbose_json/);
    assert.match(voiceField, /await persistTimedTranscript/);
    assert.match(voiceField, /onChangeText\(text\)/);
    assert.match(voiceField, /timed_transcript_persist_failed/);

    const onChangeIdx = voiceField.indexOf("onChangeText(text)");
    const timedPersistIdx = voiceField.indexOf("await persistTimedTranscript");
    const timedFailIdx = voiceField.indexOf("timed_transcript_persist_failed");
    assert.ok(onChangeIdx > 0 && timedPersistIdx > onChangeIdx);
    assert.ok(timedFailIdx > timedPersistIdx);
  });

  it("CC-002: overlay schema supports coachNote + voiceNoteRefs without migration", () => {
    assert.match(overlayTypes, /export type VoiceNoteRef/);
    assert.match(overlayTypes, /voiceNoteRefs\?: VoiceNoteRef\[\]/);
    assert.match(overlayTypes, /voiceNoteRefs\?: VoiceNoteRef\[\] \| null/);
    assert.match(overlayStore, /normalizeVoiceNoteRefs/);
    assert.match(overlayStore, /voiceNoteRefCount/);
  });

  it("CC-003: Match Breakdown upsert persists companion metadata locally", () => {
    assert.match(coachEdit, /voiceNoteRefs: match\.voiceNoteRefs/);
    assert.match(coachEdit, /setMatchVoiceNotePersisted/);
    assert.match(coachEdit, /onVoiceNotePersisted/);
    assert.match(matchEditor, /onVoiceNotePersisted/);
    assert.match(matchEditor, /playbackUri=\{match\.voiceNoteRefs/);
  });

  it("coach reopen projects voiceNoteRefs onto Match Breakdown draft", () => {
    assert.match(projection, /voiceNoteRefs\?: VoiceNoteRef\[\]/);
    assert.match(projection, /voiceNoteRefs\?\.length \? \{ voiceNoteRefs/);
    assert.match(matchEditor, /normalizeVoiceNoteRefs/);
    assert.match(matchEditor, /voiceNoteRefs/);
  });

  it("coach-device replay stays in CoachVoiceNoteField (no second recorder)", () => {
    assert.match(voiceField, /Audio\.Sound\.createAsync/);
    assert.match(voiceField, /▶ Play/);
    assert.match(voiceField, /playbackUri/);
    assert.doesNotMatch(matchEditor, /Audio\.Recording/);
    assert.doesNotMatch(matchEditor, /Audio\.Sound/);
  });

  it("Phase 1 boundary: no audio bytes or voiceNoteRefs in sync publish contracts", () => {
    assert.doesNotMatch(artifacts, /voiceNoteRefs/);
    assert.doesNotMatch(artifacts, /localUri/);
    // Worker may mention voiceNoteRefs/localUri only to reject them from artifacts.
    assert.match(worker, /if \("voiceNoteRefs" in o\) return null;/);
    assert.match(worker, /typeof o\.localUri === "string"/);
    assert.doesNotMatch(worker, /coach-voice/);
  });

  it("Phase 1 certified recording corridor remains the single voice pipeline", () => {
    assert.match(voiceField, /persistCoachVoiceAudio/);
    assert.match(voiceField, /transcribeCoachAudio/);
    assert.doesNotMatch(matchEditor, /Audio\.Recording/);
  });
});
