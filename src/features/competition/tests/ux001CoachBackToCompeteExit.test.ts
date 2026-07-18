import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * UX-001: Coach "Back to Compete" must not strand on Coach Dashboard.
 * Lane normalize resets the coach stack to `index` before focusing Compete;
 * an early return after a pending/failed verify skipped focusCompete and left
 * the user on that lane root.
 */
describe("UX-001 Coach Back to Compete exit (source)", () => {
  const syncExit = source("src/features/competition/syncTabAndExit.ts");
  const coachEdit = source("app/(tabs)/coach/kid/[kidId]/competition/edit.tsx");
  const parentEdit = source("app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx");

  it("does not suppress Compete focus after lane-normalize failure when a lane stack exists", () => {
    assert.doesNotMatch(
      syncExit,
      /if\s*\(\s*laneStackKey\s*\)\s*return\s*;/,
      "laneStackKey early-return must not skip focusCompete (UX-001)",
    );
    assert.match(syncExit, /call_focus_compete_tabs_nav/);
    assert.match(syncExit, /call_focus_compete_root_nav/);
  });

  it("still focuses Compete when bounded lane-normalize verify aborts", () => {
    const abortIdx = syncExit.indexOf("[COMP_LANE_VERIFY_ABORT]");
    assert.ok(abortIdx > 0, "verify abort path present");
    const afterAbort = syncExit.slice(abortIdx, abortIdx + 600);
    assert.match(
      afterAbort,
      /focusCompete\(\)/,
      "abort path must call focusCompete so reset-to-index cannot strand on Dashboard",
    );
  });

  it("keeps parent and coach Back to Compete on the shared exit helper", () => {
    assert.match(coachEdit, /Back to Compete/);
    assert.match(parentEdit, /Back to Compete/);
    assert.match(coachEdit, /exitToCompeteAfterCompetitionSave/);
    assert.match(parentEdit, /exitToCompeteAfterCompetitionSave/);
    assert.match(coachEdit, /actorRole:\s*"coach"/);
    assert.match(parentEdit, /actorRole:\s*"parent"/);
  });

  it("preserves certified athlete return (parent/coach) without forcing Compete", () => {
    assert.match(syncExit, /returnClass === "athlete"/);
    assert.match(syncExit, /router_replace_athlete_contract/);
    const contract = source("src/features/competition/competitionNavigationContract.ts");
    assert.match(contract, /destination: `\/\$\{lane\}\/kid\//);
  });
});
