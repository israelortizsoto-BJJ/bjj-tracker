import type { SyncedSharedAthlete, SyncedWeeklyMessagePayload } from "../../types/coachWeeklySync";
import { enforceWeeklyAthleteInvariant } from "../invariants/weeklyAthleteInvariant";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
};

type WeeklyDoc = SyncedWeeklyMessagePayload | null;

const makeDoc = (updatedAt: string): SyncedWeeklyMessagePayload => ({
  weekStartYMD: "2026-05-04",
  headline: "Headline",
  body: "Body",
  updatedAt,
});

const makeAthlete = (id: string): SyncedSharedAthlete => ({
  id,
  name: `Athlete ${id}`,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const hasInvariant = (result: {
  weeklyByAthleteId: Record<string, WeeklyDoc>;
  athletes: SyncedSharedAthlete[];
}): boolean =>
  Object.keys(result.weeklyByAthleteId).every((key) => result.athletes.some((athlete) => athlete.id === key));

describe("enforceWeeklyAthleteInvariant", () => {
  it("TEST 1 — Repair missing athletes", () => {
    const result = enforceWeeklyAthleteInvariant({
      weeklyByAthleteId: {
        a1: makeDoc("2026-05-01T00:00:00.000Z"),
        a2: makeDoc("2026-05-02T00:00:00.000Z"),
      },
      athletes: undefined,
    });

    expect(result.athletes.map((athlete) => athlete.id)).toEqual(["a1", "a2"]);
    expect(hasInvariant(result)).toBe(true);
  });

  it("TEST 2 — Filter invalid weekly keys using session", () => {
    const sessionAthletes = [makeAthlete("valid-athlete")];
    const result = enforceWeeklyAthleteInvariant({
      weeklyByAthleteId: {
        "valid-athlete": makeDoc("2026-05-01T00:00:00.000Z"),
        "invalid-athlete": makeDoc("2026-05-02T00:00:00.000Z"),
      },
      athletes: [makeAthlete("from-arg")],
      session: { athletes: sessionAthletes },
    });

    expect(Object.keys(result.weeklyByAthleteId)).toEqual(["valid-athlete"]);
    expect(result.athletes).toEqual(sessionAthletes);
    expect(hasInvariant(result)).toBe(true);
  });

  it("TEST 3 — Merge existing athletes with missing weekly keys", () => {
    const existing = [makeAthlete("a1")];
    const result = enforceWeeklyAthleteInvariant({
      weeklyByAthleteId: {
        a1: makeDoc("2026-05-01T00:00:00.000Z"),
        a2: makeDoc("2026-05-02T00:00:00.000Z"),
      },
      athletes: existing,
    });

    expect(result.athletes.map((athlete) => athlete.id)).toEqual(["a1", "a2"]);
    expect(result.athletes[0]).toEqual(existing[0]);
    expect(hasInvariant(result)).toBe(true);
  });

  it("TEST 4 — Deduplication", () => {
    const result = enforceWeeklyAthleteInvariant({
      weeklyByAthleteId: {
        " a1 ": makeDoc("2026-05-01T00:00:00.000Z"),
        "": makeDoc("2026-05-02T00:00:00.000Z"),
        a2: null,
      },
      athletes: [
        makeAthlete("a1"),
        makeAthlete(" a1 "),
        makeAthlete("a2"),
        { ...makeAthlete("a2"), name: "Duplicate" },
      ],
    });

    expect(result.athletes.map((athlete) => athlete.id)).toEqual(["a1", "a2"]);
    expect(Object.keys(result.weeklyByAthleteId)).toEqual(["a1", "a2"]);
    expect(hasInvariant(result)).toBe(true);
  });

  it("TEST 5 — Idempotency", () => {
    const input = {
      weeklyByAthleteId: {
        " a1 ": makeDoc("2026-05-01T00:00:00.000Z"),
        a2: null,
        orphan: makeDoc("2026-05-03T00:00:00.000Z"),
      },
      athletes: [makeAthlete("a1"), makeAthlete(" a1 "), makeAthlete("a2")],
    };

    const first = enforceWeeklyAthleteInvariant(input);
    const second = enforceWeeklyAthleteInvariant(first);

    expect(second).toEqual(first);
    expect(hasInvariant(first)).toBe(true);
    expect(hasInvariant(second)).toBe(true);
  });

  it("CRITICAL — invariant assertion always holds", () => {
    const cases = [
      enforceWeeklyAthleteInvariant({
        weeklyByAthleteId: {
          a1: makeDoc("2026-05-01T00:00:00.000Z"),
          a2: null,
        },
        athletes: undefined,
      }),
      enforceWeeklyAthleteInvariant({
        weeklyByAthleteId: {
          keep: makeDoc("2026-05-01T00:00:00.000Z"),
          drop: makeDoc("2026-05-02T00:00:00.000Z"),
        },
        session: { athletes: [makeAthlete("keep")] },
      }),
      enforceWeeklyAthleteInvariant({
        weeklyByAthleteId: {
          one: makeDoc("2026-05-01T00:00:00.000Z"),
        },
        athletes: [makeAthlete("one"), makeAthlete("one")],
      }),
    ];

    for (const result of cases) {
      expect(
        Object.keys(result.weeklyByAthleteId).every((key) =>
          result.athletes.some((athlete) => athlete.id === key),
        ),
      ).toBe(true);
    }
  });
});
