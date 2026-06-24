import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CompetitionAnalyticsSelection } from "../../domain/competition/selectCompetitionAnalysisForAnalytics";
import {
  shouldApplyFocusInputGeneration,
  weeklySessionSnapshotFingerprint,
} from "../useSummaryCompetitionFocusInput";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function simulateAthleteSwitchAssembly(input: {
  firstGeneration: number;
  secondGeneration: number;
  latestGenerationRef: { current: number };
  firstResult: CompetitionAnalyticsSelection;
  secondResult: CompetitionAnalyticsSelection;
}): Promise<CompetitionAnalyticsSelection | null> {
  const first = deferred<CompetitionAnalyticsSelection>();
  const second = deferred<CompetitionAnalyticsSelection>();

  const runs = [
    (async () => {
      const selection = await first.promise;
      if (
        !shouldApplyFocusInputGeneration(
          input.firstGeneration,
          input.latestGenerationRef.current,
        )
      ) {
        return null;
      }
      return selection;
    })(),
    (async () => {
      const selection = await second.promise;
      if (
        !shouldApplyFocusInputGeneration(
          input.secondGeneration,
          input.latestGenerationRef.current,
        )
      ) {
        return null;
      }
      return selection;
    })(),
  ];

  first.resolve(input.firstResult);
  input.latestGenerationRef.current = input.secondGeneration;
  second.resolve(input.secondResult);

  const outcomes = await Promise.all(runs);
  return outcomes.find((outcome) => outcome !== null) ?? null;
}

describe("useSummaryCompetitionFocusInput generation guard", () => {
  it("discards stale assembly results after athlete switch", async () => {
    const latestGenerationRef = { current: 1 };
    const legacyA = {
      source: "legacy" as const,
      entries: [{ id: "athlete_a_entry" }],
    };
    const projectedB = {
      source: "projection_ready" as const,
      entries: [{ id: "athlete_b_entry", matches: [{ id: "m1", coachNote: "Projected" }] }],
    };

    const applied = await simulateAthleteSwitchAssembly({
      firstGeneration: 1,
      secondGeneration: 2,
      latestGenerationRef,
      firstResult: legacyA,
      secondResult: projectedB,
    });

    assert.deepEqual(applied, projectedB);
  });

  it("does not apply a late first-generation result after switch", async () => {
    const latestGenerationRef = { current: 2 };
    assert.equal(shouldApplyFocusInputGeneration(1, latestGenerationRef.current), false);
    assert.equal(shouldApplyFocusInputGeneration(2, latestGenerationRef.current), true);
  });
});

describe("weeklySessionSnapshotFingerprint", () => {
  it("changes when weekly snapshot content changes", () => {
    const first = weeklySessionSnapshotFingerprint({
      weekly: {
        weekStartYMD: "2026-06-23",
        headline: "Headline",
        body: "Body",
        updatedAt: "2026-06-24T10:00:00.000Z",
      },
      weeklyByAthleteId: { ath_1: null },
      athletes: [{ id: "ath_1", name: "Athlete", createdAt: "2026-06-24T09:00:00.000Z" }],
    });
    const second = weeklySessionSnapshotFingerprint({
      weekly: {
        weekStartYMD: "2026-06-23",
        headline: "Headline",
        body: "Body",
        updatedAt: "2026-06-24T11:00:00.000Z",
      },
      weeklyByAthleteId: { ath_1: null },
      athletes: [{ id: "ath_1", name: "Athlete", createdAt: "2026-06-24T09:00:00.000Z" }],
    });

    assert.notEqual(first, second);
  });
});
