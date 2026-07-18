import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  competitionHasOccurred,
  hasParentMatchResultsWithStableLineage,
  isStableMatchLineageKey,
  parentResultsRecorded,
} from "../parentResultsRecorded.ts";

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: false,
});

const TODAY = new Date("2026-07-17T15:00:00");
const PAST = "2026-07-10";
const FUTURE = "2026-07-20";

const stableWin = { id: "match-lineage-comp-1-slot-1", matchResult: "win" as const };
const stableLoss = { id: "match-lineage-comp-1-slot-2", matchResult: "loss" as const };
const transientWin = { id: "match-new-abc", matchResult: "win" as const };
const stableUnset = { id: "match-lineage-comp-1-slot-3", matchResult: null };

describe("isStableMatchLineageKey", () => {
  it("accepts canonical lineage ids", () => {
    assert.equal(isStableMatchLineageKey("match-lineage-abc-slot-1"), true);
    assert.equal(isStableMatchLineageKey("shared-match-uuid-1"), true);
  });

  it("rejects empty and transient editor ids", () => {
    assert.equal(isStableMatchLineageKey(""), false);
    assert.equal(isStableMatchLineageKey("   "), false);
    assert.equal(isStableMatchLineageKey(null), false);
    assert.equal(isStableMatchLineageKey(undefined), false);
    assert.equal(isStableMatchLineageKey("match-new-1"), false);
    assert.equal(isStableMatchLineageKey("match-init-1"), false);
    assert.equal(isStableMatchLineageKey("match-legacy-1"), false);
  });
});

describe("competitionHasOccurred", () => {
  it("is true when eventDate is today or earlier", () => {
    assert.equal(
      competitionHasOccurred({ eventDate: PAST, now: TODAY }),
      true,
    );
    assert.equal(
      competitionHasOccurred({ eventDate: "2026-07-17", now: TODAY }),
      true,
    );
  });

  it("is true when eventStatus is completed even if date is future", () => {
    assert.equal(
      competitionHasOccurred({
        eventDate: FUTURE,
        eventStatus: "completed",
        now: TODAY,
      }),
      true,
    );
  });

  it("is false for upcoming future competitions", () => {
    assert.equal(
      competitionHasOccurred({
        eventDate: FUTURE,
        eventStatus: "upcoming",
        now: TODAY,
      }),
      false,
    );
  });

  it("is false when cancelled regardless of date or result proxies", () => {
    assert.equal(
      competitionHasOccurred({
        eventDate: PAST,
        eventStatus: "cancelled",
        now: TODAY,
      }),
      false,
    );
  });
});

describe("hasParentMatchResultsWithStableLineage", () => {
  it("requires win/loss plus stable lineage", () => {
    assert.equal(hasParentMatchResultsWithStableLineage([stableWin]), true);
    assert.equal(hasParentMatchResultsWithStableLineage([stableLoss]), true);
    assert.equal(hasParentMatchResultsWithStableLineage([transientWin]), false);
    assert.equal(hasParentMatchResultsWithStableLineage([stableUnset]), false);
    assert.equal(
      hasParentMatchResultsWithStableLineage([
        { id: "match-lineage-x", matchResult: null },
        transientWin,
      ]),
      false,
    );
  });

  it("does not treat finish-type outcome as a match result", () => {
    assert.equal(
      hasParentMatchResultsWithStableLineage([
        { id: "match-lineage-x", matchResult: null },
      ]),
      false,
    );
  });
});

describe("parentResultsRecorded (INV-CIL-4 Sprint 2)", () => {
  it("positive: occurred + competition result, no matches", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        result: "gold",
        matches: [],
        now: TODAY,
      }),
      true,
    );
  });

  it("positive: occurred + competition result with empty/unset matches", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        eventStatus: "completed",
        result: "participated",
        matches: [stableUnset],
        now: TODAY,
      }),
      true,
    );
  });

  it("positive: occurred + stable match win, no competition result", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        matches: [stableWin],
        now: TODAY,
      }),
      true,
    );
  });

  it("positive: occurred + stable match loss, no competition result", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        matches: [stableUnset, stableLoss],
        now: TODAY,
      }),
      true,
    );
  });

  it("positive: completed status + result even when date is future", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: FUTURE,
        eventStatus: "completed",
        result: "silver",
        now: TODAY,
      }),
      true,
    );
  });

  it("negative: results pending (no result, no match outcomes)", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        eventStatus: "completed",
        matches: [stableUnset],
        now: TODAY,
      }),
      false,
    );
  });

  it("negative: has not occurred (upcoming future)", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: FUTURE,
        eventStatus: "upcoming",
        result: "gold",
        matches: [stableWin],
        now: TODAY,
      }),
      false,
    );
  });

  it("negative: cancelled even with result and match outcomes", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        eventStatus: "cancelled",
        result: "gold",
        matches: [stableWin],
        now: TODAY,
      }),
      false,
    );
  });

  it("negative: match outcomes exist but lineage is transient", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        matches: [transientWin, { id: "match-init-2", matchResult: "loss" }],
        now: TODAY,
      }),
      false,
    );
  });

  it("negative: match rows exist without matchResult", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        matches: [
          { id: "match-lineage-a", matchResult: null },
          { id: "match-lineage-b", matchResult: null },
        ],
        now: TODAY,
      }),
      false,
    );
  });

  it("negative: shell-only / missing matches and result", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        now: TODAY,
      }),
      false,
    );
  });

  it("OR semantics: competition result alone satisfies without match lineage", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        result: "bronze",
        matches: [transientWin],
        now: TODAY,
      }),
      true,
    );
  });

  it("OR semantics: stable match result alone satisfies without competition result", () => {
    assert.equal(
      parentResultsRecorded({
        eventDate: PAST,
        matches: [stableWin],
        now: TODAY,
      }),
      true,
    );
  });
});
