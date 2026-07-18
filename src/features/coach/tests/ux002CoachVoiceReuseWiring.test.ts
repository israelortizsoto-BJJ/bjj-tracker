import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * UX-002: certified coach voice corridor must be single-sourced and reused.
 * Progress reflection is the first non-match reuse; Match Breakdown must share it.
 */
describe("UX-002 coach voice-first wiring (source)", () => {
  const transcription = source("src/features/coach/coachVoiceTranscription.ts");
  const voiceField = source("src/features/coach/CoachVoiceNoteField.tsx");
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");
  const progressReflection = source(
    "app/(tabs)/coach/kid/[kidId]/progress-reflection.tsx",
  );

  it("keeps Whisper upload + expo file transport in the shared transcription module", () => {
    assert.match(transcription, /api\.openai\.com\/v1\/audio\/transcriptions/);
    assert.match(transcription, /whisper-1/);
    assert.match(transcription, /expo\/fetch/);
    assert.match(transcription, /TRANSCRIBE_UPLOAD_FILENAME/);
  });

  it("CoachVoiceNoteField is the only Audio.Recording owner among coach voice surfaces", () => {
    assert.match(voiceField, /Audio\.Recording/);
    assert.match(voiceField, /transcribeCoachAudio/);
    assert.doesNotMatch(matchEditor, /Audio\.Recording/);
    assert.doesNotMatch(matchEditor, /api\.openai\.com\/v1\/audio\/transcriptions/);
    assert.doesNotMatch(progressReflection, /Audio\.Recording/);
    assert.doesNotMatch(progressReflection, /api\.openai\.com\/v1\/audio\/transcriptions/);
  });

  it("Match Breakdown reuses CoachVoiceNoteField (no second recorder)", () => {
    assert.match(matchEditor, /CoachVoiceNoteField/);
    assert.match(matchEditor, /from "\.\.\/coach\/CoachVoiceNoteField"/);
    assert.match(matchEditor, /externalStopControl/);
    assert.match(matchEditor, /matchBreakdownDisabled/);
  });

  it("progress reflection reuses CoachVoiceNoteField for long-form notes", () => {
    assert.match(progressReflection, /CoachVoiceNoteField/);
    assert.match(
      progressReflection,
      /from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/features\/coach\/CoachVoiceNoteField"/,
    );
    assert.match(progressReflection, /label="NOTES"/);
    assert.doesNotMatch(progressReflection, /<TextInput/);
  });
});
