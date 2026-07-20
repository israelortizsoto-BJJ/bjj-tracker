import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * EX-3 read path: MatchBlock chrome observes session playhead, not field snapshot.
 * Source wiring only — no runtime ownership change.
 */
describe("MatchBlock session playhead observation (EX-3 read path)", () => {
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");

  it("derives MatchBlock play chrome from session.getPlayhead()", () => {
    assert.match(matchEditor, /session\.getPlayhead\(\)/);
    assert.match(matchEditor, /getPlayhead\(\)\.playbackState === "playing"/);
  });

  it("does not mirror video field subscribe into MatchBlock isPlaying chrome", () => {
    assert.doesNotMatch(
      matchEditor,
      /playbackCoordinator\.subscribe\(\(snapshot\)\s*=>\s*\{\s*setIsPlaying/,
    );
    assert.doesNotMatch(
      matchEditor,
      /playbackCoordinator\.getSnapshot\(\)\.playbackState === "playing"/,
    );
  });
});

/**
 * EX-3 write path: MatchBlock is the first product consumer of session.requestSeek.
 * Field replay remains field-local (Invariant 21) — not routed through requestSeek.
 */
describe("MatchBlock session seek authority (EX-3 write path)", () => {
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");
  const matchMedia = source("src/components/MatchMediaAttachments.tsx");

  it("MatchBlock calls session.requestSeek from onReplay (first product consumer)", () => {
    assert.match(matchEditor, /sessionRef\.current\.requestSeek\(0\)/);
    assert.match(matchEditor, /onReplay=\{\(\) => \{/);
  });

  it("does not replace field-local Replay with session seek (Invariant 21)", () => {
    assert.match(matchMedia, /playbackRef\.current\.replay\(\)/);
    assert.doesNotMatch(matchMedia, /requestSeek/);
    assert.doesNotMatch(matchEditor, /playbackCoordinator\.seek\(/);
    assert.doesNotMatch(matchEditor, /playbackRef\.current\.seek\(/);
  });
});
