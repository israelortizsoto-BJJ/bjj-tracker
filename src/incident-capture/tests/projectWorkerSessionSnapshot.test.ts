import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CoachWeeklySyncSessionResponse } from "../../types/coachWeeklySync";

import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../workerSessionSnapshotContract";
import {
  projectWorkerSessionSnapshot,
  sanitizeFetchFailureReason,
  type ProjectWorkerSessionLinkInput,
} from "../projectWorkerSessionSnapshot";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const FULL_LINK_TOKEN = "abcd1234efgh5678ijklmnopqrstuvwx";
const LINK_TOKEN_TAIL = "qrstuvwx";

function baseSession(
  overrides: Partial<CoachWeeklySyncSessionResponse> = {},
): CoachWeeklySyncSessionResponse {
  return {
    schemaVersion: 2,
    coach: { id: "coach_1", displayName: "Coach Pat" },
    weekly: {
      weekStartYMD: "2026-06-16",
      headline: "SECRET_HEADLINE",
      body: "SECRET_WEEKLY_BODY",
      updatedAt: "2026-06-18T10:00:00.000Z",
    },
    weeklyByAthleteId: {
      shared_ath_alice: {
        weekStartYMD: "2026-06-16",
        headline: "SECRET_ALICE_HEADLINE",
        body: "SECRET_ALICE_BODY",
        updatedAt: "2026-06-18T11:00:00.000Z",
      },
    },
    athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
    competitions: [
      {
        id: "comp_1",
        sharedAthleteId: "shared_ath_alice",
        tournamentName: "SECRET_TOURNAMENT",
        eventDate: "2026-06-20",
        createdAt: CAPTURED_AT,
        updatedAt: CAPTURED_AT,
      },
    ],
    competitionAggregateByAthleteId: {
      shared_ath_alice: {
        sharedAthleteId: "shared_ath_alice",
        updatedAt: "2026-06-18T12:00:00.000Z",
        totalCompetitions: 1,
        totalMatches: 3,
        wins: 2,
        losses: 1,
        winRate: 0.67,
        submissionRate: null,
        fastestSubmissionSeconds: null,
        averageMatchSeconds: null,
        dominantWinStyle: null,
      },
    },
    competitionTopologyByAthleteId: {
      shared_ath_alice: {
        schemaVersion: 1,
        sharedAthleteId: "shared_ath_alice",
        updatedAt: "2026-06-18T13:00:00.000Z",
        competitions: [
          {
            sharedCompetitionId: "comp_1",
            sharedAthleteId: "shared_ath_alice",
            competitionLineageKey: "lineage_comp_1",
            updatedAt: CAPTURED_AT,
            matches: [
              {
                matchLineageKey: "lineage_match_1",
                ordinal: 1,
                result: "win",
                finishType: "submission",
                durationSeconds: 120,
                parentMediaRefs: [{ kind: "image", uri: "https://secret.example/media.jpg" }],
              },
            ],
          },
        ],
      },
    },
    trainingProofByAthleteId: {
      shared_ath_alice: {
        sharedAthleteId: "shared_ath_alice",
        updatedAt: "2026-06-18T14:00:00.000Z",
        currentWeekSessionCount: 2,
        lastTrainingDateYMD: "2026-06-17",
        dominantSystemKey: "guard",
        topSystems: [],
        topTechniques: [],
        weeklyGoalMet: true,
      },
    },
    coachMatchBreakdownArtifacts: {
      shared_ath_alice: {
        schemaVersion: 1,
        sharedAthleteId: "shared_ath_alice",
        updatedAt: "2026-06-18T15:00:00.000Z",
        artifacts: [
          {
            sharedAthleteId: "shared_ath_alice",
            sharedCompetitionId: "comp_1",
            matchLineageKey: "lineage_match_1",
            coachNote: "SECRET_COACH_NOTE",
            updatedAt: CAPTURED_AT,
          },
        ],
      },
    },
    ...overrides,
  };
}

function successfulLinkInput(
  linkToken: string,
  session: CoachWeeklySyncSessionResponse,
  dataSource: "network" | "cache" = "network",
): ProjectWorkerSessionLinkInput {
  return {
    linkToken,
    fetchSuccess: true,
    dataSource,
    sessionFetchedAt: CAPTURED_AT,
    httpStatus: dataSource === "network" ? 200 : 404,
    session,
  };
}

describe("projectWorkerSessionSnapshot", () => {
  it("maps required Tier 1 contract fields from worker session substrate", () => {
    const out = projectWorkerSessionSnapshot(
      [successfulLinkInput(FULL_LINK_TOKEN, baseSession())],
      {
        deviceRole: "coach",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    assert.equal(out.contractVersion, WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(out.capturedAt, CAPTURED_AT);
    assert.equal(out.deviceRole, "coach");
    assert.equal(out.syncConfigured, true);
    assert.equal(out.captureMode, "get_only");
    assert.equal(out.activeLinkCount, 1);
    assert.equal(out.sessionsFetchedOkCount, 1);
    assert.equal(out.allSessionsFetched, true);
    assert.equal(out.slice, "coach");

    const link = out.links[0];
    assert.equal(link.linkTokenTail, LINK_TOKEN_TAIL);
    assert.equal(link.fetchSuccess, true);
    assert.equal(link.dataSource, "network");
    assert.equal(link.sessionFetchedAt, CAPTURED_AT);
    assert.deepEqual(link.athleteIds, ["shared_ath_alice"]);

    const domain = link.athleteDomains?.[0];
    assert.ok(domain);
    assert.equal(domain.sharedAthleteId, "shared_ath_alice");
    assert.deepEqual(domain.competitionIds, ["comp_1"]);
    assert.equal(domain.competitionCount, 1);
    assert.equal(domain.weeklyKeyPresent, true);
    assert.equal(domain.weeklyUpdatedAt, "2026-06-18T11:00:00.000Z");
    assert.equal(domain.aggregateUpdatedAt, "2026-06-18T12:00:00.000Z");
    assert.equal(domain.topologyUpdatedAt, "2026-06-18T13:00:00.000Z");
    assert.equal(domain.trainingProofUpdatedAt, "2026-06-18T14:00:00.000Z");
    assert.equal(domain.breakdownSetUpdatedAt, "2026-06-18T15:00:00.000Z");
    assert.equal(domain.breakdownArtifactCount, 1);
  });

  it("redacts secrets, narrative content, and raw worker payloads from export", () => {
    const out = projectWorkerSessionSnapshot(
      [successfulLinkInput(FULL_LINK_TOKEN, baseSession())],
      {
        deviceRole: "parent",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    const serialized = JSON.stringify(out);
    const forbidden = [
      FULL_LINK_TOKEN,
      "SECRET_HEADLINE",
      "SECRET_WEEKLY_BODY",
      "SECRET_ALICE_HEADLINE",
      "SECRET_ALICE_BODY",
      "SECRET_TOURNAMENT",
      "SECRET_COACH_NOTE",
      "https://secret.example/media.jpg",
      "writerSecret",
      "parentWriterSecret",
    ];

    for (const needle of forbidden) {
      assert.equal(serialized.includes(needle), false, `forbidden leak: ${needle}`);
    }

    assert.equal(out.links[0].linkTokenTail, LINK_TOKEN_TAIL);
    assert.deepEqual(out.links[0].athleteDomains?.[0]?.breakdownLineageKeys, ["lineage_match_1"]);
    assert.equal(out.inviteLevelWeeklyUpdatedAt, "2026-06-18T10:00:00.000Z");
  });

  it("supports multi-link capture with partial fetch success for FC-04", () => {
    const out = projectWorkerSessionSnapshot(
      [
        successfulLinkInput("inviteaaaa11111111bbbbbbbb22222222", baseSession()),
        {
          linkToken: "invitecccc33333333dddddddd44444444",
          fetchSuccess: false,
          fetchFailureReason: "HTTP 503",
          httpStatus: 503,
          dataSource: "none",
        },
      ],
      {
        deviceRole: "coach",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    assert.equal(out.activeLinkCount, 2);
    assert.equal(out.sessionsFetchedOkCount, 1);
    assert.equal(out.allSessionsFetched, false);
    assert.equal(out.links[0].fetchSuccess, true);
    assert.equal(out.links[1].fetchSuccess, false);
    assert.equal(out.links[1].fetchFailureReason, "HTTP 503");
    assert.equal(out.links[1].httpStatus, 503);
    assert.equal(out.links[1].dataSource, "none");
    assert.deepEqual(out.athletesUnion, [
      { sharedAthleteId: "shared_ath_alice", name: "Alice" },
    ]);
    assert.equal(out.inviteLevelWeeklyUpdatedAt, undefined);
  });

  it("labels cache fallback evidence without claiming live network truth", () => {
    const out = projectWorkerSessionSnapshot(
      [
        successfulLinkInput(
          FULL_LINK_TOKEN,
          baseSession(),
          "cache",
        ),
      ],
      {
        deviceRole: "parent",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    const link = out.links[0];
    assert.equal(link.fetchSuccess, true);
    assert.equal(link.dataSource, "cache");
    assert.equal(link.httpStatus, 404);
    assert.equal(link.sessionFetchedAt, CAPTURED_AT);
  });

  it("surfaces fetch failure handling when network and cache are unavailable", () => {
    const out = projectWorkerSessionSnapshot(
      [
        {
          linkToken: FULL_LINK_TOKEN,
          fetchSuccess: false,
          fetchFailureReason: "Network request failed",
          httpStatus: 0,
          dataSource: "none",
        },
      ],
      {
        deviceRole: "coach",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    const link = out.links[0];
    assert.equal(link.fetchSuccess, false);
    assert.equal(link.fetchFailureReason, "Network request failed");
    assert.equal(link.dataSource, "none");
    assert.equal(link.athleteIds, undefined);
    assert.equal(link.athleteDomains, undefined);
    assert.equal(out.sessionsFetchedOkCount, 0);
    assert.equal(out.allSessionsFetched, false);
  });

  it("supports FC-03 localization via per-athlete artifact timestamps on worker", () => {
    const session = baseSession({
      competitionAggregateByAthleteId: {},
      competitionTopologyByAthleteId: {},
      trainingProofByAthleteId: {},
      coachMatchBreakdownArtifacts: {},
    });

    const out = projectWorkerSessionSnapshot(
      [successfulLinkInput(FULL_LINK_TOKEN, session)],
      {
        deviceRole: "parent",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    const domain = out.links[0].athleteDomains?.[0];
    assert.ok(domain);
    assert.equal(domain.aggregateUpdatedAt, null);
    assert.equal(domain.topologyUpdatedAt, null);
    assert.equal(domain.trainingProofUpdatedAt, null);
    assert.equal(domain.breakdownSetUpdatedAt, null);
    assert.equal(domain.breakdownArtifactCount, 0);
    assert.equal(domain.weeklyUpdatedAt, "2026-06-18T11:00:00.000Z");
  });

  it("supports FC-04 localization via per-link transport matrix fields", () => {
    const out = projectWorkerSessionSnapshot(
      [
        {
          linkToken: "shorttok",
          fetchSuccess: false,
          fetchFailureReason: "That invite code was not found. Check for typos.",
          httpStatus: 404,
          dataSource: "none",
        },
      ],
      {
        deviceRole: "parent",
        capturedAt: CAPTURED_AT,
        syncConfigured: true,
      },
    );

    const link = out.links[0];
    assert.equal(link.linkTokenTail, "shorttok");
    assert.equal(link.fetchSuccess, false);
    assert.equal(link.httpStatus, 404);
    assert.match(link.fetchFailureReason ?? "", /not found/i);
  });
});

describe("sanitizeFetchFailureReason", () => {
  it("truncates long failure reasons for redaction safety", () => {
    const long = "x".repeat(300);
    const out = sanitizeFetchFailureReason(long);
    assert.equal(out.length, 281);
    assert.ok(out.endsWith("…"));
  });
});
