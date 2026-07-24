import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");
const voice = source("src/features/coach/CoachVoiceNoteField.tsx");
const editor = source("src/features/competition/competitionMatchEditor.tsx");
const screen = source("app/(tabs)/coach/kid/[kidId]/competition/edit.tsx");

describe("Slice 2 shared pause to VoiceNote wiring", () => {
  it("confirms a bound pause before native recording starts", () => {
    const confirmation = voice.indexOf("await beforeStartRecording?.()");
    const nativeStart = voice.indexOf("await recording.startAsync()");
    assert.ok(confirmation >= 0 && confirmation < nativeStart);
    assert.match(voice, /beginVoiceNoteAttempt\(\{/);
    assert.match(voice, /attemptGateRef\.current\.isActive\(attempt\.id\)/);
  });

  it("keeps no-binding recording unaligned and validates bound snapshots at persistence", () => {
    assert.match(editor, /if \(!controller\?\.getActiveBinding\(\)\) return null;/);
    assert.match(editor, /requestConfirmedBoundVideoPause\(\)/);
    assert.match(editor, /getCoachMatchMediaAttachment/);
    assert.match(editor, /current\.matchMediaAssetId === attempt\.alignment\.matchMediaAssetId/);
    assert.match(editor, /current\.revision === attempt\.alignment\.attachmentRevision/);
    assert.match(screen, /alignment\?: VoiceNoteRef\["alignment"\]/);
  });
});
