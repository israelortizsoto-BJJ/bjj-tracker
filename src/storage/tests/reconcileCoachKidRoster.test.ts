import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeInviteLinkToken } from "../../coachShare/inviteLinkToken";
import type { Kid, KidsById } from "../../types/coachKid";
import type { SyncedSharedAthlete } from "../../types/coachWeeklySync";
import {
  applySharedAthleteToKidRow,
  findUniqueLocalOnlyKidForRemoteAthlete,
} from "../coachKidRosterMergePure";

const TOKEN = "abc123invite";
const TOKEN_NORM = normalizeInviteLinkToken(TOKEN);

const REMOTE_ATHLETE: SyncedSharedAthlete = {
  id: "shared-athlete-1",
  name: "Alice",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NOW = "2026-01-01T00:00:00.000Z";

function localKid(id: string, name: string): Kid {
  return { id, name, createdAt: NOW, updatedAt: NOW };
}

/** Mirrors reconcile per-athlete path: byShared hit, then collapse, then `kid_shared_${id}` insert. */
function applyReconcileAthlete(
  next: KidsById,
  byShared: Map<string, Kid>,
  athlete: SyncedSharedAthlete,
  token: string,
): void {
  const id = athlete.id.trim();
  if (!id) return;

  const existing = byShared.get(id);
  if (existing) {
    return;
  }

  const collapseTarget = findUniqueLocalOnlyKidForRemoteAthlete(next, athlete.name);
  if (collapseTarget) {
    const updated = applySharedAthleteToKidRow(collapseTarget, athlete, token, NOW);
    next[collapseTarget.id] = updated;
    byShared.set(id, updated);
    return;
  }

  const localId = `kid_shared_${id}`;
  next[localId] = {
    id: localId,
    name: athlete.name,
    sharedAthleteId: id,
    sharedFromInviteTokenNorm: token,
    createdAt: athlete.createdAt,
    updatedAt: NOW,
  };
  byShared.set(id, next[localId]);
}

describe("reconcileCoachKidRosterFromWriterSessions duplicate prevention", () => {
  it("collapses one local-only row onto existing kid id when remote name matches", () => {
    const next: KidsById = { kid_local_alice: localKid("kid_local_alice", "Alice") };
    const byShared = new Map<string, Kid>();

    applyReconcileAthlete(next, byShared, REMOTE_ATHLETE, TOKEN_NORM);

    const rows = Object.values(next);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "kid_local_alice");
    assert.equal(rows[0]?.sharedAthleteId, "shared-athlete-1");
    assert.equal(rows[0]?.sharedFromInviteTokenNorm, TOKEN_NORM);
    assert.equal(next["kid_shared_shared-athlete-1"], undefined);
  });

  it("inserts kid_shared when multiple local-only rows share the remote name", () => {
    const next: KidsById = {
      kid_a: localKid("kid_a", "  Alice  "),
      kid_b: localKid("kid_b", "Alice"),
    };
    const byShared = new Map<string, Kid>();

    applyReconcileAthlete(next, byShared, REMOTE_ATHLETE, TOKEN_NORM);

    assert.ok(next["kid_shared_shared-athlete-1"]);
    assert.equal(next["kid_shared_shared-athlete-1"]?.sharedAthleteId, "shared-athlete-1");
    assert.equal(next.kid_a?.sharedAthleteId, undefined);
    assert.equal(next.kid_b?.sharedAthleteId, undefined);
    assert.equal(Object.keys(next).length, 3);
  });

  it("is idempotent on a second reconcile pass", () => {
    const next: KidsById = { kid_local_alice: localKid("kid_local_alice", "Alice") };
    const byShared = new Map<string, Kid>();

    applyReconcileAthlete(next, byShared, REMOTE_ATHLETE, TOKEN_NORM);
    const afterFirst = structuredClone(next);

    assert.ok(byShared.get(REMOTE_ATHLETE.id));
    assert.equal(findUniqueLocalOnlyKidForRemoteAthlete(next, REMOTE_ATHLETE.name), null);

    applyReconcileAthlete(next, byShared, REMOTE_ATHLETE, TOKEN_NORM);

    assert.deepEqual(next, afterFirst);
    assert.equal(Object.keys(next).length, 1);
    assert.equal(next.kid_local_alice?.sharedAthleteId, "shared-athlete-1");
    assert.equal(next["kid_shared_shared-athlete-1"], undefined);
  });
});
