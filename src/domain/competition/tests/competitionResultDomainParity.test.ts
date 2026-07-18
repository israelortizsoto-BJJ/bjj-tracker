import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  competitionResultPersistFields,
  hydrateCompetitionResultDraft,
  newCompetitionResultDraft,
  toggleCompetitionResultDraft,
  type CompetitionResultDraft,
} from "../competitionResultDraft.ts";

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: false,
});

type StoredCompetition = {
  id: string;
  tournamentName: string;
  eventDate: string;
  result?: Exclude<CompetitionResultDraft, undefined>;
};

/**
 * Minimal in-memory store mirroring createKidCompetitionEntry /
 * updateKidCompetitionEntry result semantics used by all editors:
 * omit result when undefined; explicit undefined clears on update.
 */
function createStored(input: {
  tournamentName: string;
  eventDate: string;
  resultDraft: CompetitionResultDraft;
}): StoredCompetition {
  return {
    id: `entry_${Math.random().toString(16).slice(2)}`,
    tournamentName: input.tournamentName,
    eventDate: input.eventDate,
    ...competitionResultPersistFields(input.resultDraft),
  };
}

function updateStored(
  existing: StoredCompetition,
  patch: {
    tournamentName: string;
    eventDate: string;
    resultDraft: CompetitionResultDraft;
  },
): StoredCompetition {
  const next: StoredCompetition = {
    ...existing,
    tournamentName: patch.tournamentName,
    eventDate: patch.eventDate,
    result: patch.resultDraft,
  };
  if (typeof patch.resultDraft === "undefined") {
    delete next.result;
  }
  return next;
}

/**
 * Simulates Family / Kid / Coach Review editor contract:
 * create with no result → open editor → save unchanged → still no result.
 */
function simulateEditorNoResultRoundTrip(editor: "family" | "kid" | "coach") {
  const createDraft = newCompetitionResultDraft();
  assert.equal(createDraft, undefined, `${editor}: new draft must be undefined`);

  const created = createStored({
    tournamentName: `${editor} Open`,
    eventDate: "2026-07-17",
    resultDraft: createDraft,
  });
  assert.equal(
    created.result,
    undefined,
    `${editor}: create must persist Outcome Not Yet Recorded`,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(created, "result"),
    false,
    `${editor}: create must omit result key when undefined`,
  );

  const openDraft = hydrateCompetitionResultDraft(created.result);
  assert.equal(
    openDraft,
    undefined,
    `${editor}: hydrate must not coerce undefined → participated`,
  );
  assert.notEqual(
    openDraft,
    "participated",
    `${editor}: presentation default must not become draft value`,
  );

  const saved = updateStored(created, {
    tournamentName: created.tournamentName,
    eventDate: created.eventDate,
    resultDraft: openDraft,
  });
  assert.equal(
    saved.result,
    undefined,
    `${editor}: save without changing Result must preserve undefined`,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(saved, "result"),
    false,
    `${editor}: post-save must omit result when still unset`,
  );
}

describe("competitionResultDraft (INV-CIL-2 / INV-CIL-3)", () => {
  it("does not normalize domain absence into participated", () => {
    assert.equal(hydrateCompetitionResultDraft(undefined), undefined);
    assert.equal(hydrateCompetitionResultDraft("gold"), "gold");
    assert.equal(hydrateCompetitionResultDraft("participated"), "participated");
    assert.deepEqual(competitionResultPersistFields(undefined), {});
    assert.deepEqual(competitionResultPersistFields("silver"), { result: "silver" });
  });

  it("keeps presentation toggle clearable without inventing a default", () => {
    assert.equal(newCompetitionResultDraft(), undefined);
    assert.equal(toggleCompetitionResultDraft(undefined, "gold"), "gold");
    assert.equal(toggleCompetitionResultDraft("gold", "gold"), undefined);
    assert.equal(toggleCompetitionResultDraft("gold", "silver"), "silver");
  });
});

describe("Competition Result Domain Parity — editor round-trips", () => {
  it("Family Editor: create → no result → open → save → still no result", () => {
    simulateEditorNoResultRoundTrip("family");
  });

  it("Kid Editor: create → no result → open → save → still no result", () => {
    simulateEditorNoResultRoundTrip("kid");
  });

  it("Coach Review: create → no result → open → save → still no result", () => {
    simulateEditorNoResultRoundTrip("coach");
  });

  it("round-trips identical domain values across every editor", () => {
    for (const result of [undefined, "gold", "participated"] as const) {
      const drafts = (["family", "kid", "coach"] as const).map(() =>
        hydrateCompetitionResultDraft(result),
      );
      assert.deepEqual(drafts, [result, result, result]);
      const patches = drafts.map((d) => competitionResultPersistFields(d));
      assert.deepEqual(patches[0], patches[1]);
      assert.deepEqual(patches[1], patches[2]);
    }
  });

  it("regression: historical coerce undefined ?? participated must not occur", () => {
    const domain: CompetitionResultDraft = undefined;
    const coercedLegacy = domain ?? "participated";
    const fixed = hydrateCompetitionResultDraft(domain);
    assert.equal(coercedLegacy, "participated");
    assert.equal(fixed, undefined);
    assert.notEqual(fixed, coercedLegacy);
  });
});
