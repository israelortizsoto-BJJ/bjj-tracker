import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * Source-level regression: Coach Match Breakdown authoring + publish must
 * gate on parentResultsRecorded (INV-CIL-4). Do not redefine AI/analytics.
 */
describe("Coach Match Breakdown ParentResultsRecorded gate (source)", () => {
  const coachEdit = source("app/(tabs)/coach/kid/[kidId]/competition/edit.tsx");
  const matchEditor = source("src/features/competition/competitionMatchEditor.tsx");

  it("coach overlay save path imports and evaluates parentResultsRecorded before upsert/publish", () => {
    assert.match(coachEdit, /from "@\/src\/domain\/competition\/parentResultsRecorded"/);
    assert.match(coachEdit, /parentResultsRecorded\(/);
    assert.match(
      coachEdit,
      /parent_results_recorded_required_for_match_breakdown/,
    );
    const overlaySaveStart = coachEdit.indexOf("if (canonicalReadOnly && overlayScope)");
    assert.ok(overlaySaveStart > 0, "overlay save path present");
    const overlaySave = coachEdit.slice(overlaySaveStart);
    const gateIdx = overlaySave.indexOf("parent_results_recorded_required_for_match_breakdown");
    const upsertIdx = overlaySave.indexOf("await upsertMatchBreakdownOverlay");
    const publishIdx = overlaySave.indexOf("schedulePublishCoachMatchBreakdownArtifacts");
    assert.ok(gateIdx > 0, "gate marker present in overlay save path");
    assert.ok(upsertIdx > gateIdx, "upsert must follow parentResultsRecorded gate");
    assert.ok(publishIdx > gateIdx, "publish must follow parentResultsRecorded gate");
  });

  it("MatchBlock exposes matchBreakdownDisabled for authoring UI gate", () => {
    assert.match(matchEditor, /matchBreakdownDisabled/);
    assert.match(matchEditor, /Waiting for parent-recorded results/);
    assert.match(coachEdit, /matchBreakdownDisabled=\{matchBreakdownAuthoringBlocked\}/);
  });

  it("does not wire the predicate into AI or analytics selection", () => {
    const analytics = source(
      "src/domain/competition/selectCompetitionAnalysisForAnalytics.ts",
    );
    const readiness = source("src/domain/competition/resolveCoachAnalysisReadiness.ts");
    assert.doesNotMatch(analytics, /parentResultsRecorded/);
    assert.doesNotMatch(readiness, /parentResultsRecorded/);
  });
});
