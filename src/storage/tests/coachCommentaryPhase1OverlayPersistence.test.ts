import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

/**
 * Phase 1 overlay persistence evidence (source + contract).
 * Runtime AsyncStorage store tests share the same loader constraints as sibling store suites.
 */
describe("Coach Commentary Phase 1 — overlay voiceNoteRefs persistence", () => {
  const overlayStore = source("src/storage/coachMatchBreakdownOverlayStore.ts");
  const overlayTypes = source("src/types/coachMatchBreakdownOverlay.ts");

  it("defines VoiceNoteRef with localUri companion metadata (no audio bytes)", () => {
    assert.match(overlayTypes, /export type VoiceNoteRef = \{/);
    assert.match(overlayTypes, /localUri: string;/);
    assert.match(overlayTypes, /createdAt: string;/);
    assert.doesNotMatch(overlayTypes, /audioBytes|base64Audio|audioBlob/);
  });

  it("normalizeVoiceNoteRef requires id + localUri + createdAt", () => {
    assert.match(overlayTypes, /export function normalizeVoiceNoteRef/);
    assert.match(overlayTypes, /if \(!id \|\| !localUri \|\| !createdAt\) return null;/);
    assert.match(overlayTypes, /export function normalizeVoiceNoteRefs/);
  });

  it("store normalize + write paths retain voiceNoteRefs for legacy-safe reopen", () => {
    assert.match(overlayStore, /normalizeVoiceNoteRefs\(row\.voiceNoteRefs\)/);
    assert.match(overlayStore, /existing\?\.voiceNoteRefs/);
    assert.match(
      overlayStore,
      /Object\.prototype\.hasOwnProperty\.call\(input\.patch, "voiceNoteRefs"\)/,
    );
    assert.match(overlayStore, /voiceNoteRefCount/);
  });

  it("clearing voiceNoteRefs is an explicit patch (null/empty) without requiring migration", () => {
    assert.match(overlayStore, /if \(nextRefs\) overlay\.voiceNoteRefs = nextRefs;/);
    assert.match(overlayStore, /else delete overlay\.voiceNoteRefs;/);
  });
});
