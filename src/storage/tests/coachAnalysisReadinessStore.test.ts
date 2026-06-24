import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  beginNextCoachAnalysisReadinessGeneration,
  getAllCoachAnalysisReadiness,
  getCoachAnalysisReadiness,
  resolveCoachAnalysisReadinessGeneration,
} from "../coachAnalysisReadinessStore";

const ATHLETE_ID = "shared_ath_1";
const START_1 = "2026-06-24T10:00:00.000Z";
const RESOLVE_1 = "2026-06-24T10:01:00.000Z";
const START_2 = "2026-06-24T11:00:00.000Z";
const RESOLVE_2 = "2026-06-24T11:01:00.000Z";
const ARTIFACT_UPDATED_AT = "2026-06-24T09:59:00.000Z";
const storage = new Map<string, string>();
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;

beforeEach(() => {
  storage.clear();
  AsyncStorage.getItem = async (key: string) => storage.get(key) ?? null;
  AsyncStorage.setItem = async (key: string, value: string) => {
    storage.set(key, value);
  };
});

after(() => {
  AsyncStorage.getItem = originalGetItem;
  AsyncStorage.setItem = originalSetItem;
});

async function begin(
  startedAt: string,
) {
  return beginNextCoachAnalysisReadinessGeneration({
    sharedAthleteId: ATHLETE_ID,
    startedAt,
    hydrationSource: "coach_writer_sessions",
  });
}

describe("coachAnalysisReadinessStore", () => {
  it("persists and reloads a PENDING generation", async () => {
    const outcome = await begin(START_1);

    assert.equal(outcome.status, "written");
    assert.deepEqual(await getCoachAnalysisReadiness(ATHLETE_ID), {
      sharedAthleteId: ATHLETE_ID,
      state: "PENDING",
      generation: 1,
      startedAt: START_1,
      hydrationSource: "coach_writer_sessions",
    });
    assert.deepEqual(Object.keys(await getAllCoachAnalysisReadiness()), [
      ATHLETE_ID,
    ]);
  });

  it("persists READY and records it as the last confirmed authority", async () => {
    await begin(START_1);

    const outcome = await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: {
        state: "READY",
        artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
      },
    });

    assert.equal(outcome.status, "written");
    assert.deepEqual(await getCoachAnalysisReadiness(ATHLETE_ID), {
      sharedAthleteId: ATHLETE_ID,
      state: "READY",
      generation: 1,
      startedAt: START_1,
      resolvedAt: RESOLVE_1,
      hydrationSource: "coach_writer_sessions",
      artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
      lastConfirmedState: "READY",
      lastConfirmedAt: RESOLVE_1,
      lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
    });
  });

  it("preserves READY confirmation through a later FAILED generation", async () => {
    await begin(START_1);
    await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: {
        state: "READY",
        artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
      },
    });
    await begin(START_2);

    await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 2,
      resolvedAt: RESOLVE_2,
      resolution: { state: "FAILED" },
    });

    assert.deepEqual(await getCoachAnalysisReadiness(ATHLETE_ID), {
      sharedAthleteId: ATHLETE_ID,
      state: "FAILED",
      generation: 2,
      startedAt: START_2,
      resolvedAt: RESOLVE_2,
      hydrationSource: "coach_writer_sessions",
      lastConfirmedState: "READY",
      lastConfirmedAt: RESOLVE_1,
      lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
    });
  });

  it("preserves EMPTY_READY confirmation through a later FAILED generation", async () => {
    await begin(START_1);
    await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: { state: "EMPTY_READY" },
    });
    await begin(START_2);

    await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 2,
      resolvedAt: RESOLVE_2,
      resolution: { state: "FAILED" },
    });

    assert.deepEqual(await getCoachAnalysisReadiness(ATHLETE_ID), {
      sharedAthleteId: ATHLETE_ID,
      state: "FAILED",
      generation: 2,
      startedAt: START_2,
      resolvedAt: RESOLVE_2,
      hydrationSource: "coach_writer_sessions",
      lastConfirmedState: "EMPTY_READY",
      lastConfirmedAt: RESOLVE_1,
    });
  });

  it("allocates monotonic generations from persisted state", async () => {
    const first = await begin(START_1);
    const second = await begin(START_2);

    assert.equal(first.status, "written");
    assert.equal(second.status, "written");
    assert.equal(first.status === "written" ? first.record.generation : null, 1);
    assert.equal(second.status === "written" ? second.record.generation : null, 2);
    assert.equal(
      (await getCoachAnalysisReadiness(ATHLETE_ID))?.generation,
      2,
    );
  });

  it("serializes overlapping starts into distinct monotonic generations", async () => {
    const [first, second] = await Promise.all([
      begin(START_1),
      begin(START_2),
    ]);

    assert.equal(first.status, "written");
    assert.equal(second.status, "written");
    assert.deepEqual(
      [
        first.status === "written" ? first.record.generation : null,
        second.status === "written" ? second.record.generation : null,
      ],
      [1, 2],
    );
  });

  it("ignores completion from a superseded generation", async () => {
    await begin(START_1);
    await begin(START_2);

    const outcome = await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: { state: "READY" },
    });

    assert.deepEqual(outcome, {
      status: "ignored_superseded_generation",
      sharedAthleteId: ATHLETE_ID,
      incomingGeneration: 1,
      existingGeneration: 2,
    });
    assert.equal(
      (await getCoachAnalysisReadiness(ATHLETE_ID))?.state,
      "PENDING",
    );
  });

  it("ignores resolution when no generation has started", async () => {
    const outcome = await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: { state: "FAILED" },
    });

    assert.deepEqual(outcome, {
      status: "ignored_missing_generation",
      sharedAthleteId: ATHLETE_ID,
      incomingGeneration: 1,
    });
  });

  it("accepts only one terminal resolution per generation", async () => {
    await begin(START_1);
    const first = await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: { state: "READY" },
    });

    const second = await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_2,
      resolution: { state: "FAILED" },
    });

    assert.equal(first.status, "written");
    assert.deepEqual(second, {
      status: "ignored_already_resolved",
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      existingState: "READY",
    });
    assert.equal(
      (await getCoachAnalysisReadiness(ATHLETE_ID))?.state,
      "READY",
    );
  });

  it("keeps last confirmed authority while the next generation is PENDING", async () => {
    await begin(START_1);
    await resolveCoachAnalysisReadinessGeneration({
      sharedAthleteId: ATHLETE_ID,
      generation: 1,
      resolvedAt: RESOLVE_1,
      resolution: { state: "EMPTY_READY" },
    });

    await begin(START_2);

    assert.deepEqual(await getCoachAnalysisReadiness(ATHLETE_ID), {
      sharedAthleteId: ATHLETE_ID,
      state: "PENDING",
      generation: 2,
      startedAt: START_2,
      hydrationSource: "coach_writer_sessions",
      lastConfirmedState: "EMPTY_READY",
      lastConfirmedAt: RESOLVE_1,
    });
  });
});
