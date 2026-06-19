import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AthleteAuthoritySnapshot } from "../../identity/types";
import type { KidsById } from "../../types/coachKid";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { projectAuthoritySnapshot } from "../projectAuthoritySnapshot";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";

function baseSnap(overrides: Partial<AthleteAuthoritySnapshot> = {}): AthleteAuthoritySnapshot {
  const loadedKids: KidsById = {
    kid_alice: {
      id: "kid_alice",
      name: "Alice",
      createdAt: CAPTURED_AT,
      updatedAt: CAPTURED_AT,
      sharedAthleteId: "shared_ath_alice",
    },
  };

  return {
    sorted: [{ id: "shared_ath_alice", name: "Alice" }],
    operatingAthleteRoster: [{ id: "shared_ath_alice", name: "Alice" }],
    resolvedId: "shared_ath_alice",
    loadedKids,
    authorityBootstrapState: "ready",
    coachOperatingAthleteChoices: [],
    parentActiveAthleteId: "shared_ath_alice",
    coachSessionRefreshDegraded: false,
    linkedSharedAthleteIds: ["shared_ath_alice"],
    meta: { sourceTrigger: "focus_effect", role: "coach" },
    ...overrides,
  };
}

describe("projectAuthoritySnapshot", () => {
  it("maps required Tier 1 contract fields from authority substrate", () => {
    const snap = baseSnap();
    const out = projectAuthoritySnapshot(snap, {
      deviceRole: "coach",
      capturedAt: CAPTURED_AT,
      sourceTrigger: "soft_refresh",
    });

    assert.equal(out.contractVersion, AUTHORITY_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(out.capturedAt, CAPTURED_AT);
    assert.equal(out.deviceRole, "coach");
    assert.equal(out.resolvedOperatingAthleteId, "shared_ath_alice");
    assert.equal(out.parentActiveAthleteId, "shared_ath_alice");
    assert.equal(out.authorityBootstrapState, "ready");
    assert.equal(out.coachSessionRefreshDegraded, false);
    assert.equal(out.operatingAthleteRosterCount, 1);
    assert.deepEqual(out.linkedSharedAthleteIds, ["shared_ath_alice"]);
  });

  it("includes recommended roster summaries without secrets or kid payloads", () => {
    const out = projectAuthoritySnapshot(baseSnap(), {
      deviceRole: "parent",
      capturedAt: CAPTURED_AT,
    });

    assert.equal(out.selectedAthleteDisplayName, "Alice");
    assert.equal(out.loadedKidCount, 1);
    assert.deepEqual(out.operatingAthleteRoster, [
      {
        sharedAthleteId: "shared_ath_alice",
        name: "Alice",
        kidId: "kid_alice",
      },
    ]);
    assert.equal(out.sourceTrigger, "focus_effect");
  });

  it("surfaces parent vs resolved OAI divergence for FC-01 localization", () => {
    const out = projectAuthoritySnapshot(
      baseSnap({
        resolvedId: "",
        parentActiveAthleteId: "pa_stale_legacy",
        authorityBootstrapState: "coach_unresolved",
      }),
      { deviceRole: "coach", capturedAt: CAPTURED_AT },
    );

    assert.equal(out.resolvedOperatingAthleteId, "");
    assert.equal(out.parentActiveAthleteId, "pa_stale_legacy");
    assert.equal(out.authorityBootstrapState, "coach_unresolved");
    assert.equal(out.selectedAthleteDisplayName, undefined);
  });
});
