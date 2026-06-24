import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { CoachWeeklySyncSessionResponse } from "../../../types/coachWeeklySync";
import {
  startCoachAnalysisReadinessRun,
} from "../coachAnalysisReadinessCoordinator";
import type { CoachAnalysisReadinessStoreWriteOutcome } from "../../../storage/coachAnalysisReadinessStore";

const STARTED_AT = "2026-06-24T10:00:00.000Z";
const RESOLVED_AT = "2026-06-24T10:01:00.000Z";

function session(input: {
  athleteId: string;
  classification: "populated" | "empty" | "malformed";
}): CoachWeeklySyncSessionResponse {
  const artifactSet =
    input.classification === "populated"
      ? {
          schemaVersion: 1 as const,
          sharedAthleteId: input.athleteId,
          updatedAt: "2026-06-24T09:59:00.000Z",
          artifacts: [
            {
              sharedAthleteId: input.athleteId,
              sharedCompetitionId: "shared_comp_1",
              matchLineageKey: "match_1",
              coachNote: "Analysis",
              updatedAt: "2026-06-24T09:59:00.000Z",
            },
          ],
        }
      : undefined;
  return {
    coach: { id: "coach_1", displayName: "Coach" },
    weekly: null,
    athletes: [
      {
        id: input.athleteId,
        name: "Athlete",
        createdAt: STARTED_AT,
      },
    ],
    competitions: [],
    coachMatchBreakdownArtifacts: artifactSet
      ? { [input.athleteId]: artifactSet }
      : {},
    coachMatchBreakdownArtifactEvidence: {
      fieldClassification:
        input.classification === "malformed" ? "malformed" : "valid",
      athleteEntryClassificationById: {
        [input.athleteId]: input.classification,
      },
    },
  };
}

function harness() {
  const generations = new Map<string, number>();
  const calls: string[] = [];
  const hydrationSources: string[] = [];
  const resolutions: {
    sharedAthleteId: string;
    generation: number;
    state: string;
  }[] = [];
  const beginGeneration = async (input: {
    sharedAthleteId: string;
    startedAt: string;
    hydrationSource: "coach_writer_sessions" | "parent_session_refresh";
  }): Promise<CoachAnalysisReadinessStoreWriteOutcome> => {
    const generation = (generations.get(input.sharedAthleteId) ?? 0) + 1;
    generations.set(input.sharedAthleteId, generation);
    hydrationSources.push(input.hydrationSource);
    calls.push(`begin:${input.sharedAthleteId}:${generation}`);
    return {
      status: "written",
      record: {
        sharedAthleteId: input.sharedAthleteId,
        state: "PENDING",
        generation,
        startedAt: input.startedAt,
        hydrationSource: input.hydrationSource,
      },
    };
  };
  const resolveGeneration = async (input: {
    sharedAthleteId: string;
    generation: number;
    resolvedAt: string;
    resolution: {
      state: "READY" | "EMPTY_READY" | "FAILED";
      artifactSetUpdatedAt?: string;
    };
  }): Promise<CoachAnalysisReadinessStoreWriteOutcome> => {
    calls.push(
      `resolve:${input.sharedAthleteId}:${input.generation}:${input.resolution.state}`,
    );
    resolutions.push({
      sharedAthleteId: input.sharedAthleteId,
      generation: input.generation,
      state: input.resolution.state,
    });
    return {
      status: "written",
      record: {
        sharedAthleteId: input.sharedAthleteId,
        state: input.resolution.state,
        generation: input.generation,
        startedAt: STARTED_AT,
        resolvedAt: input.resolvedAt,
        hydrationSource: "coach_writer_sessions",
      },
    };
  };
  return {
    calls,
    hydrationSources,
    resolutions,
    beginGeneration,
    resolveGeneration,
  };
}

describe("coach analysis readiness orchestration", () => {
  it("begins known athletes immediately and resolves after successful evidence", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_1"],
      linkKeys: ["A"],
      startedAt: STARTED_AT,
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });

    assert.deepEqual(h.calls, ["begin:shared_ath_1:1"]);
    run.recordSuccessfulSession(
      "A",
      session({ athleteId: "shared_ath_1", classification: "populated" }),
    );
    await run.finalize(RESOLVED_AT);

    assert.deepEqual(h.resolutions, [
      {
        sharedAthleteId: "shared_ath_1",
        generation: 1,
        state: "READY",
      },
    ]);
  });

  it("preserves the Parent session refresh hydration source", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_1"],
      linkKeys: ["A"],
      startedAt: STARTED_AT,
      hydrationSource: "parent_session_refresh",
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });

    run.recordSuccessfulSession(
      "A",
      session({ athleteId: "shared_ath_1", classification: "empty" }),
    );
    await run.finalize(RESOLVED_AT);

    assert.deepEqual(h.hydrationSources, ["parent_session_refresh"]);
    assert.equal(h.resolutions[0]?.state, "EMPTY_READY");
  });

  it("begins a newly discovered athlete once identity arrives", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: [],
      linkKeys: ["A"],
      startedAt: STARTED_AT,
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });
    assert.deepEqual(h.calls, []);

    run.recordSuccessfulSession(
      "A",
      session({ athleteId: "shared_ath_new", classification: "empty" }),
    );
    await run.finalize(RESOLVED_AT);

    assert.deepEqual(h.calls, [
      "begin:shared_ath_new:1",
      "resolve:shared_ath_new:1:EMPTY_READY",
    ]);
  });

  it("allows successful link evidence to win over another link failure", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_1"],
      linkKeys: ["A", "B"],
      startedAt: STARTED_AT,
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });
    run.recordSuccessfulSession(
      "A",
      session({ athleteId: "shared_ath_1", classification: "populated" }),
    );
    run.recordFailedLink("B");

    await run.finalize(RESOLVED_AT);

    assert.equal(h.resolutions[0]?.state, "READY");
  });

  it("resolves all-failed link evidence as FAILED", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_1"],
      linkKeys: ["A", "B"],
      startedAt: STARTED_AT,
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });
    run.recordFailedLink("A");
    run.recordFailedLink("B");

    await run.finalize(RESOLVED_AT);

    assert.equal(h.resolutions[0]?.state, "FAILED");
  });

  it("finalizes a readiness run only once", async () => {
    const h = harness();
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_1"],
      linkKeys: ["A"],
      startedAt: STARTED_AT,
      beginGeneration: h.beginGeneration,
      resolveGeneration: h.resolveGeneration,
    });
    run.recordSuccessfulSession(
      "A",
      session({ athleteId: "shared_ath_1", classification: "empty" }),
    );

    const first = await run.finalize(RESOLVED_AT);
    const second = await run.finalize(RESOLVED_AT);

    assert.equal(first.length, 1);
    assert.deepEqual(second, []);
    assert.equal(h.resolutions.length, 1);
  });

  it("does not propagate readiness persistence failures into hydration", async () => {
    const run = await startCoachAnalysisReadinessRun({
      initialSharedAthleteIds: ["shared_ath_known"],
      linkKeys: ["A"],
      startedAt: STARTED_AT,
      beginGeneration: async (input) => {
        if (input.sharedAthleteId === "shared_ath_known") {
          throw new Error("readiness storage unavailable");
        }
        return {
          status: "written",
          record: {
            sharedAthleteId: input.sharedAthleteId,
            state: "PENDING",
            generation: 1,
            startedAt: input.startedAt,
            hydrationSource: input.hydrationSource,
          },
        };
      },
      resolveGeneration: async () => {
        throw new Error("readiness storage unavailable");
      },
    });
    run.recordSuccessfulSession(
      "A",
      session({
        athleteId: "shared_ath_discovered",
        classification: "populated",
      }),
    );

    const outcomes = await run.finalize(RESOLVED_AT);

    assert.deepEqual(outcomes, []);
  });

  it("keeps the production coordinator boundaries in the required order", () => {
    const source = readFileSync(
      "src/storage/coachKidStore.ts",
      "utf8",
    );
    const functionSource = source.slice(
      source.indexOf(
        "export async function refreshCoachWriterSessionsAndReconcileStores",
      ),
      source.indexOf(
        "export async function mergeRemoteSharedAthletesIntoKids",
      ),
    );

    const start = functionSource.indexOf(
      "startCoachAnalysisReadinessRun",
    );
    const fetch = functionSource.indexOf("coachSyncFetchSession");
    const cache = functionSource.indexOf("setCachedWeeklyForLinkToken");
    const successEvidence = functionSource.indexOf(
      "recordSuccessfulSession",
    );
    const catchBoundary = functionSource.indexOf("} catch (error) {");
    const failureEvidence = functionSource.indexOf("recordFailedLink");
    const reconcile = functionSource.indexOf(
      "reconcileCoachMatchBreakdownArtifacts",
    );
    const finalize = functionSource.indexOf(
      "readinessRun?.finalize(reconcileFinishedAt)",
    );
    const bump = functionSource.indexOf("bumpCoachSyncHydrationVersion");

    assert.ok(start >= 0 && start < fetch);
    assert.ok(fetch < cache);
    assert.ok(cache < successEvidence);
    assert.ok(successEvidence < catchBoundary);
    assert.ok(catchBoundary < failureEvidence);
    assert.ok(successEvidence < reconcile);
    assert.ok(reconcile < finalize);
    assert.ok(finalize < bump);
  });
});
