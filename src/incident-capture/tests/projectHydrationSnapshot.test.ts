import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CoachWriterSessionRefreshResult } from "../../storage/coachKidStore";
import type { CoachLink } from "../../types/coachShare";

import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import {
  hydrationTriggerClassFromSourceTrigger,
  projectHydrationSnapshot,
} from "../projectHydrationSnapshot";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const FULL_LINK_TOKEN = "abcd1234efgh5678ijklmnopqrstuvwx";
const LINK_TOKEN_TAIL = "qrstuvwx";

function writerLink(): CoachLink {
  return {
    id: "link_1",
    coachId: "coach_1",
    parentProfileId: "parent_1",
    scope: "child",
    status: "active",
    canReceiveCompletionReceipts: false,
    createdAt: CAPTURED_AT,
    updatedAt: CAPTURED_AT,
    weeklySync: {
      linkToken: FULL_LINK_TOKEN,
      apiBaseUrl: "https://sync.example",
    },
  };
}

function refreshResult(
  overrides: Partial<CoachWriterSessionRefreshResult> = {},
): CoachWriterSessionRefreshResult {
  return {
    successfulSnapshots: [],
    writerLinks: [],
    inviteSessionAthletesByToken: {},
    hydrationOutcome: {
      reconcileAttempted: true,
      reconcileCompleted: false,
    },
    ...overrides,
  };
}

describe("projectHydrationSnapshot", () => {
  it("maps coach shared-pass full reconcile with all stage flags", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 3,
      lastBumpReason: "refreshCoachWriterSessionsAndReconcileStores_complete",
      lastBumpAt: CAPTURED_AT,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      coachSessionRefreshDegraded: false,
      sourceTrigger: "soft_refresh",
      writerSessionRefresh: refreshResult({
        writerLinks: [writerLink()],
        successfulSnapshots: [
          {
            linkTokenNorm: FULL_LINK_TOKEN,
            athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
          },
        ],
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: true,
          reconcileFinishedAt: CAPTURED_AT,
          stageRosterCompleted: true,
          stageShellsCompleted: true,
          stageAggregateCompleted: true,
          stageTopologyCompleted: true,
          stageTrainingProofCompleted: true,
          stageBreakdownCompleted: true,
          stageBreakdownPruneCompleted: true,
        },
      }),
    });

    assert.equal(out.contractVersion, HYDRATION_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(out.captureMode, "shared_authority_reconcile");
    assert.equal(out.writerLinkCount, 1);
    assert.equal(out.sessionsFetchedOkCount, 1);
    assert.equal(out.allSessionsFetched, true);
    assert.equal(out.reconcileCompleted, true);
    assert.equal(out.stageRosterCompleted, true);
    assert.equal(out.stageBreakdownPruneCompleted, true);
    assert.equal(out.hydrationTriggerClass, "pull");
    assert.equal(out.lastBumpReason, "refreshCoachWriterSessionsAndReconcileStores_complete");
  });

  it("surfaces skip reconcile when writer links exist but no successful fetches", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 1,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      coachSessionRefreshDegraded: true,
      writerSessionRefresh: refreshResult({
        writerLinks: [writerLink()],
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: false,
          skipReconcileReason: "writerLinksButNoSuccessfulSessionFetches",
        },
      }),
    });

    assert.equal(out.skipReconcileReason, "writerLinksButNoSuccessfulSessionFetches");
    assert.equal(out.coachSessionRefreshDegraded, true);
    assert.equal(out.reconcileCompleted, false);
    assert.equal(out.stageRosterCompleted, undefined);
    assert.equal(out.allSessionsFetched, false);
  });

  it("surfaces early exit when coach sync is not configured", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: false,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 0,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      writerSessionRefresh: refreshResult({
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: false,
          earlyExitReason: "coachSyncNotConfigured",
        },
      }),
    });

    assert.equal(out.earlyExitReason, "coachSyncNotConfigured");
    assert.equal(out.writerLinkCount, 0);
    assert.equal(out.sessionsFetchedOkCount, 0);
  });

  it("surfaces early exit when no writer links exist", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 0,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      writerSessionRefresh: refreshResult({
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: false,
          earlyExitReason: "noWriterLinks",
        },
      }),
    });

    assert.equal(out.earlyExitReason, "noWriterLinks");
  });

  it("read-only mode omits reconcile stage flags and sets reconcileAttempted false", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "read_only_state",
      hydrationVersion: 5,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: false,
      readOnlyCoachWriterLinkCount: 2,
      readOnlyCoachSessionsFetchedOkCount: 1,
      writerSessionRefresh: refreshResult({
        writerLinks: [writerLink(), writerLink()],
        successfulSnapshots: [
          {
            linkTokenNorm: FULL_LINK_TOKEN,
            athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
          },
        ],
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: true,
          stageRosterCompleted: true,
        },
      }),
    });

    assert.equal(out.captureMode, "read_only_state");
    assert.equal(out.reconcileAttempted, false);
    assert.equal(out.stageRosterCompleted, undefined);
    assert.equal(out.writerLinkCount, 2);
    assert.equal(out.sessionsFetchedOkCount, 1);
    assert.equal(out.allSessionsFetched, false);
  });

  it("maps source triggers to hydration trigger classes", () => {
    assert.equal(hydrationTriggerClassFromSourceTrigger("focus_effect"), "focus");
    assert.equal(hydrationTriggerClassFromSourceTrigger("soft_refresh"), "pull");
    assert.equal(
      hydrationTriggerClassFromSourceTrigger("active_athlete_store_subscription"),
      "boot",
    );
    assert.equal(hydrationTriggerClassFromSourceTrigger("coach_sync_hydration"), "invalidation");
    assert.equal(hydrationTriggerClassFromSourceTrigger("export"), "export");
    assert.equal(hydrationTriggerClassFromSourceTrigger("something_else"), "unknown");
  });

  it("redacts cache links to token tails without weekly narrative", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "parent",
      syncConfigured: true,
      captureMode: "read_only_state",
      hydrationVersion: 1,
      capturedAt: CAPTURED_AT,
      activeLinkCount: 1,
      sessionCachePresentCount: 1,
      parentWeeklyFetchSource: "cache",
      parentOverlayArtifactsPresent: false,
      cacheLinks: [
        {
          linkTokenTail: LINK_TOKEN_TAIL,
          fetchedAt: CAPTURED_AT,
          sessionPresent: true,
          dataSource: "cache",
        },
      ],
    });

    assert.equal(out.cacheLinks?.[0]?.linkTokenTail, LINK_TOKEN_TAIL);
    assert.equal(out.activeLinkCount, 1);
    assert.equal(out.sessionCachePresentCount, 1);
    assert.equal(out.reconcileAttempted, false);
    assert.equal((out as Record<string, unknown>).weekly, undefined);
    assert.equal((out as Record<string, unknown>).session, undefined);
    assert.equal((out as Record<string, unknown>).headline, undefined);
  });

  it("does not embed worker session payloads in coach hydration output", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 1,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      writerSessionRefresh: refreshResult({
        writerLinks: [writerLink()],
        successfulSnapshots: [
          {
            linkTokenNorm: FULL_LINK_TOKEN,
            athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
            session: {
              schemaVersion: 2,
              coach: { id: "coach_1", displayName: "SECRET" },
              weekly: {
                weekStartYMD: "2026-06-16",
                headline: "SECRET_HEADLINE",
                body: "SECRET_BODY",
                updatedAt: CAPTURED_AT,
              },
              athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
              competitions: [],
            },
          },
        ],
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: true,
          reconcileFinishedAt: CAPTURED_AT,
          stageRosterCompleted: true,
        },
      }),
    });

    const serialized = JSON.stringify(out);
    assert.equal(serialized.includes("SECRET_HEADLINE"), false);
    assert.equal(serialized.includes("SECRET_BODY"), false);
    assert.equal((out as Record<string, unknown>).competitions, undefined);
  });

  it("derives partial multi-invite allSessionsFetched as false", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "shared_authority_reconcile",
      hydrationVersion: 1,
      capturedAt: CAPTURED_AT,
      reconcileAttempted: true,
      writerSessionRefresh: refreshResult({
        writerLinks: [writerLink(), { ...writerLink(), id: "link_2" }],
        successfulSnapshots: [
          {
            linkTokenNorm: FULL_LINK_TOKEN,
            athletes: [{ id: "shared_ath_alice", name: "Alice", createdAt: CAPTURED_AT }],
          },
        ],
        hydrationOutcome: {
          reconcileAttempted: true,
          reconcileCompleted: false,
          skipReconcileReason: "writerLinksButNoSuccessfulSessionFetches",
        },
      }),
    });

    assert.equal(out.writerLinkCount, 2);
    assert.equal(out.sessionsFetchedOkCount, 1);
    assert.equal(out.allSessionsFetched, false);
  });

  it("projects parent slice without coach reconcile fields", () => {
    const out = projectHydrationSnapshot({
      deviceRole: "parent",
      syncConfigured: true,
      captureMode: "read_only_state",
      hydrationVersion: 2,
      capturedAt: CAPTURED_AT,
      activeLinkCount: 2,
      sessionCachePresentCount: 1,
      parentWeeklyFetchSource: "none",
      parentOverlayArtifactsPresent: true,
      cacheLinks: [
        {
          linkTokenTail: LINK_TOKEN_TAIL,
          fetchedAt: null,
          sessionPresent: false,
          dataSource: "none",
        },
      ],
    });

    assert.equal(out.writerLinkCount, undefined);
    assert.equal(out.reconcileCompleted, undefined);
    assert.equal(out.parentOverlayArtifactsPresent, true);
    assert.equal(out.parentWeeklyFetchSource, "none");
  });
});
