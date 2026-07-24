import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = readFileSync(path.join(root, "src/components/MatchMediaAttachments.tsx"), "utf8");
const flags = readFileSync(path.join(root, "src/config/sharedMatchMediaUploadFlags.ts"), "utf8");

describe("MatchMediaAttachments shared binding", () => {
  it("keeps the editor binding gate default-off", () => {
    assert.match(flags, /EXPO_PUBLIC_SHARED_MATCH_MEDIA_EDITOR_BINDING_CLIENT === "1"/);
    assert.match(source, /if \(!sharedMatchMediaEditorBindingClientEnabled/);
  });

  it("binds only a keyed, loaded native generation", () => {
    assert.match(source, /key=\{videoGenerationKey\}/);
    assert.match(source, /lifecycleRef\.current\?\.markLoaded\(videoGenerationKey\)/);
    assert.match(source, /handleNativeError\(renderedSharedGenerationToken\)/);
    assert.doesNotMatch(source, /invalidateSharedBinding\("Shared editor media native error/);
    assert.match(source, /createMatchMediaBindingLifecycle/);
  });

  it("cancels and clears strict pause work on binding invalidation", () => {
    assert.match(source, /lifecycleRef\.current\?\.invalidate/);
    assert.match(source, /requestConfirmedBoundVideoPause/);
    assert.match(source, /handleNativeError\(renderedSharedGenerationToken\)/);
  });

  it("uses authoritative expiry to invalidate only the current generation", () => {
    assert.match(source, /lifecycleRef\.current\?\.accept\(candidate\)/);
    assert.match(source, /lifecycleRef\.current\?\.dispose\(\)/);
  });

  it("routes scope, hydration, and gate transitions through authoritative invalidation", () => {
    assert.match(source, /sharedAthleteId, sharedPlaybackScope\.sharedCompetitionId, sharedPlaybackScope\.matchLineageKey, String\(sharedPlaybackScope\.hydrationVersion\)/);
    assert.match(source, /invalidateSharedBinding\("Shared editor media scope changed\."\)/);
    assert.match(source, /if \(!sharedMatchMediaEditorBindingClientEnabled\) return;/);
    assert.match(source, /if \(!sharedPlaybackScope \|\| !scopeKey\) return;/);
    assert.match(source, /if \(lifecycleRef\.current\?\.hasCandidate\(\)\) return;/);
    assert.doesNotMatch(source, /invalidateSharedBinding\("Shared editor media scope changed\."\);\s*if \(!sharedMatchMediaEditorBindingClientEnabled\)/s);
  });

  it("uses the pure resolver without Film Room ownership", () => {
    assert.match(source, /resolveCoachMatchMediaPlaybackOnce/);
    assert.doesNotMatch(source, /matchMediaAssetId:\s*"seed"|expectedRevision:\s*1/);
    assert.doesNotMatch(source, /useCoachMatchMediaPlaybackUri|FilmRoomSessionCoordinator|FilmRoomScreen/);
  });
});
