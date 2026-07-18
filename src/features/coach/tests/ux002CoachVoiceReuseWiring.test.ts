import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * UX-002: certified coach voice corridor must be single-sourced and reused.
 * Progress reflection, Current Read, Direction of Growth, Weekly Focus, and
 * Behavior Under Pressure reuse the same non-match voice corridor; Match
 * Breakdown must share it.
 */
describe("UX-002 coach voice-first wiring (source)", () => {
  const transcription = source("src/features/coach/coachVoiceTranscription.ts");
  const voiceField = source("src/features/coach/CoachVoiceNoteField.tsx");
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");
  const progressReflection = source(
    "app/(tabs)/coach/kid/[kidId]/progress-reflection.tsx",
  );
  const currentState = source("app/(tabs)/coach/kid/[kidId]/current-state.tsx");
  const directionOfGrowth = source("app/(tabs)/coach/kid/[kidId]/what-matters-next.tsx");
  const weeklyFocus = source("app/(tabs)/coach/kid/[kidId]/weekly-focus.tsx");
  const kidDetail = source("src/features/kid/KidDetailScreen.tsx");

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
    assert.doesNotMatch(currentState, /Audio\.Recording/);
    assert.doesNotMatch(currentState, /api\.openai\.com\/v1\/audio\/transcriptions/);
    assert.doesNotMatch(directionOfGrowth, /Audio\.Recording/);
    assert.doesNotMatch(directionOfGrowth, /api\.openai\.com\/v1\/audio\/transcriptions/);
    assert.doesNotMatch(weeklyFocus, /Audio\.Recording/);
    assert.doesNotMatch(weeklyFocus, /api\.openai\.com\/v1\/audio\/transcriptions/);
    assert.doesNotMatch(kidDetail, /Audio\.Recording/);
    assert.doesNotMatch(kidDetail, /api\.openai\.com\/v1\/audio\/transcriptions/);
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

  it("Current Read reuses CoachVoiceNoteField for the coach-authored narrative", () => {
    assert.match(currentState, /CoachVoiceNoteField/);
    assert.match(
      currentState,
      /from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/features\/coach\/CoachVoiceNoteField"/,
    );
    assert.match(currentState, /label="What you saw"/);
    assert.match(currentState, /value=\{narrativeDraft\}/);
    assert.match(currentState, /onChangeText=\{setNarrativeDraft\}/);
  });

  it("Direction of Growth reuses CoachVoiceNoteField for both narrative fields", () => {
    assert.match(directionOfGrowth, /CoachVoiceNoteField/);
    assert.match(
      directionOfGrowth,
      /from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/features\/coach\/CoachVoiceNoteField"/,
    );
    assert.match(directionOfGrowth, /label="Coaching direction"/);
    assert.match(directionOfGrowth, /value=\{headlineDraft\}/);
    assert.match(directionOfGrowth, /onChangeText=\{setHeadlineDraft\}/);
    assert.match(directionOfGrowth, /label="Why this direction"/);
    assert.match(directionOfGrowth, /value=\{detailDraft\}/);
    assert.match(directionOfGrowth, /onChangeText=\{setDetailDraft\}/);
  });

  it("Behavior Under Pressure reuses CoachVoiceNoteField for mat observations", () => {
    assert.match(kidDetail, /CoachVoiceNoteField/);
    assert.match(kidDetail, /from "\.\.\/coach\/CoachVoiceNoteField"/);
    assert.match(kidDetail, /placeholder="Add what you saw on the mat"/);
    assert.match(kidDetail, /value=\{notesDraft\}/);
    assert.match(kidDetail, /onChangeText=\{setNotesDraft\}/);
  });

  it("Weekly Focus reuses CoachVoiceNoteField for family-facing narrative notes", () => {
    assert.match(weeklyFocus, /CoachVoiceNoteField/);
    assert.match(
      weeklyFocus,
      /from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/features\/coach\/CoachVoiceNoteField"/,
    );
    assert.match(weeklyFocus, /label="FAMILY NOTE \(OPTIONAL\)"/);
    assert.match(weeklyFocus, /value=\{customNote\}/);
    assert.match(weeklyFocus, /onChangeText=\{setCustomNote\}/);
    assert.match(weeklyFocus, /label="WHAT WE SHARPENED WITH COACH"/);
    assert.match(weeklyFocus, /value=\{familyCoachRecapNote\}/);
    assert.match(weeklyFocus, /onChangeText=\{setFamilyCoachRecapNote\}/);
  });
});
