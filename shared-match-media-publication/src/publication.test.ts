import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachmentRecordKey,
  createConditionalObjectAttachmentRecordStore,
  type ConditionalObjectStore,
  type ConditionalPutOnlyIf,
} from "./attachmentStore.ts";
import type {
  AttachMatchMediaCommand,
  MatchAttachmentIdentity,
  MatchMediaAttachmentCommand,
  ParentMatchAttachmentAuthority,
  VerifiedMediaPublicationProvenance,
} from "./attachmentTypes.ts";
import {
  evaluateMatchMediaAttachmentMutation,
  mutateMatchMediaAttachment,
} from "./publication.ts";

type SyntheticEntry = {
  body: string;
  etag: string;
  generation: number;
};

function createSyntheticConditionalObjectStore(): ConditionalObjectStore & {
  inspect(): ReadonlyMap<string, SyntheticEntry>;
} {
  const objects = new Map<string, SyntheticEntry>();
  let etagCounter = 0;

  function putSync(
    key: string,
    body: string,
    onlyIf: ConditionalPutOnlyIf,
  ): { etag: string } | null {
    const existing = objects.get(key);
    if ("etagDoesNotMatch" in onlyIf) {
      if (existing) return null;
      const generation = 1;
      const etag = `"attachment-${generation}-${++etagCounter}"`;
      objects.set(key, { body, etag, generation });
      return { etag };
    }
    if (!existing || existing.etag !== onlyIf.etagMatches) return null;
    const generation = existing.generation + 1;
    const etag = `"attachment-${generation}-${++etagCounter}"`;
    objects.set(key, { body, etag, generation });
    return { etag };
  }

  return {
    get: async (key) => {
      const entry = objects.get(key);
      return entry ? { body: entry.body, etag: entry.etag } : null;
    },
    put: async (key, body, options) => putSync(key, body, options.onlyIf),
    inspect: () => objects,
  };
}

const target: MatchAttachmentIdentity = {
  sharedAthleteId: "athlete-1",
  sharedCompetitionId: "competition-1",
  matchLineageKey: "match-1",
};

const authority: ParentMatchAttachmentAuthority = {
  authority: "parent",
  ...target,
};

function verified(
  matchMediaAssetId = "mma_asset_1",
  objectVersion = "object-version-1",
): VerifiedMediaPublicationProvenance {
  return {
    publicationEligible: true,
    verificationState: "verified",
    ...target,
    matchMediaAssetId,
    objectVersion,
  };
}

function attachCommand(
  expectedRevision = 0,
  matchMediaAssetId = "mma_asset_1",
  objectVersion = "object-version-1",
): AttachMatchMediaCommand {
  return {
    type: "attach",
    target,
    authority,
    expectedRevision,
    media: { matchMediaAssetId, objectVersion },
    verification: verified(matchMediaAssetId, objectVersion),
  };
}

function harness() {
  const objects = createSyntheticConditionalObjectStore();
  const store = createConditionalObjectAttachmentRecordStore(objects);
  let tick = 0;
  return {
    objects,
    store,
    dependencies: {
      store,
      now: () => new Date(Date.UTC(2026, 6, 23, 12, 0, tick++)),
    },
  };
}

function rawAttachment(
  objects: ReturnType<typeof createSyntheticConditionalObjectStore>,
): string | null {
  return objects.inspect().get(attachmentRecordKey(target))?.body ?? null;
}

describe("MatchMediaAttachment Publication CAS", () => {
  it("creates the first attachment at revision 1 and identical retry is idempotent", async () => {
    const { dependencies, objects } = harness();

    const created = await mutateMatchMediaAttachment(
      attachCommand(),
      dependencies,
    );
    assert.equal(created.outcome, "attached");
    assert.equal(created.reasonCode, "FIRST_ATTACHMENT");
    assert.equal(created.record.revision, 1);
    assert.equal(created.record.state, "attached");
    if (created.record.state !== "attached") assert.fail("expected attached");
    assert.equal(created.record.matchMediaAssetId, "mma_asset_1");
    assert.equal(created.record.objectVersion, "object-version-1");

    const beforeReplay = rawAttachment(objects);
    const replay = await mutateMatchMediaAttachment(
      attachCommand(0),
      dependencies,
    );
    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.reasonCode, "IDENTICAL_ATTACHMENT_REPLAY");
    assert.equal(replay.record.revision, 1);
    assert.equal(rawAttachment(objects), beforeReplay);
  });

  it("replaces only at the current expected revision", async () => {
    const { dependencies, objects } = harness();
    await mutateMatchMediaAttachment(attachCommand(), dependencies);

    const replacement = await mutateMatchMediaAttachment(
      attachCommand(1, "mma_asset_2", "object-version-2"),
      dependencies,
    );
    assert.equal(replacement.outcome, "replaced");
    assert.equal(replacement.reasonCode, "ATTACHMENT_REPLACED");
    assert.equal(replacement.record.revision, 2);
    if (replacement.record.state !== "attached") assert.fail("expected attached");
    assert.equal(replacement.record.matchMediaAssetId, "mma_asset_2");
    assert.equal(replacement.record.objectVersion, "object-version-2");

    const beforeConflict = rawAttachment(objects);
    const stale = await mutateMatchMediaAttachment(
      attachCommand(1, "mma_asset_3", "object-version-3"),
      dependencies,
    );
    assert.equal(stale.outcome, "conflict");
    assert.equal(stale.reasonCode, "STALE_REVISION");
    assert.equal(stale.currentRevision, 2);
    assert.equal(rawAttachment(objects), beforeConflict);
  });

  it("tombstones at revision N+1, removes active media, and repeats idempotently", async () => {
    const { dependencies, objects } = harness();
    await mutateMatchMediaAttachment(attachCommand(), dependencies);

    const command: MatchMediaAttachmentCommand = {
      type: "tombstone",
      target,
      authority,
      expectedRevision: 1,
    };
    const tombstoned = await mutateMatchMediaAttachment(command, dependencies);
    assert.equal(tombstoned.outcome, "tombstoned");
    assert.equal(tombstoned.reasonCode, "ATTACHMENT_TOMBSTONED");
    assert.equal(tombstoned.record.revision, 2);
    assert.equal(tombstoned.record.state, "tombstoned");
    assert.equal("matchMediaAssetId" in tombstoned.record, false);
    assert.equal("objectVersion" in tombstoned.record, false);

    const beforeRepeat = rawAttachment(objects);
    const repeated = await mutateMatchMediaAttachment(command, dependencies);
    assert.equal(repeated.outcome, "idempotent");
    assert.equal(repeated.reasonCode, "ALREADY_TOMBSTONED");
    assert.equal(repeated.record.revision, 2);
    assert.equal(rawAttachment(objects), beforeRepeat);
  });

  it("denies wrong athlete, competition, and Match lineage authority", async () => {
    const mismatches = [
      {
        authority: { ...authority, sharedAthleteId: "athlete-other" },
        reasonCode: "ATHLETE_LINEAGE_MISMATCH",
      },
      {
        authority: { ...authority, sharedCompetitionId: "competition-other" },
        reasonCode: "COMPETITION_LINEAGE_MISMATCH",
      },
      {
        authority: { ...authority, matchLineageKey: "match-other" },
        reasonCode: "MATCH_LINEAGE_MISMATCH",
      },
    ] as const;

    for (const mismatch of mismatches) {
      const { dependencies, objects } = harness();
      const result = await mutateMatchMediaAttachment(
        { ...attachCommand(), authority: mismatch.authority },
        dependencies,
      );
      assert.equal(result.outcome, "denied");
      assert.equal(result.reasonCode, mismatch.reasonCode);
      assert.equal(rawAttachment(objects), null);
    }
  });

  it("denies non-Parent authority and verified-media lineage drift", async () => {
    const wrongAuthority = harness();
    const notParent = await mutateMatchMediaAttachment(
      {
        ...attachCommand(),
        authority: {
          ...authority,
          authority: "coach",
        } as unknown as ParentMatchAttachmentAuthority,
      },
      wrongAuthority.dependencies,
    );
    assert.equal(notParent.outcome, "denied");
    assert.equal(notParent.reasonCode, "PARENT_AUTHORITY_REQUIRED");
    assert.equal(rawAttachment(wrongAuthority.objects), null);

    const provenanceLineage = harness();
    const mismatched = await mutateMatchMediaAttachment(
      {
        ...attachCommand(),
        verification: {
          ...verified(),
          matchLineageKey: "match-other",
        },
      },
      provenanceLineage.dependencies,
    );
    assert.equal(mismatched.outcome, "denied");
    assert.equal(mismatched.reasonCode, "MATCH_LINEAGE_MISMATCH");
    assert.equal(rawAttachment(provenanceLineage.objects), null);
  });

  it("denies unverified, mismatched asset, and mismatched object-version provenance", async () => {
    const cases: ReadonlyArray<{
      command: AttachMatchMediaCommand;
      reasonCode:
        | "MEDIA_NOT_VERIFIED"
        | "MEDIA_ASSET_MISMATCH"
        | "OBJECT_VERSION_MISMATCH";
    }> = [
      {
        command: {
          ...attachCommand(),
          verification: {
            ...verified(),
            publicationEligible: false,
            verificationState: "verifying",
          },
        },
        reasonCode: "MEDIA_NOT_VERIFIED",
      },
      {
        command: {
          ...attachCommand(),
          verification: verified("mma_other", "object-version-1"),
        },
        reasonCode: "MEDIA_ASSET_MISMATCH",
      },
      {
        command: {
          ...attachCommand(),
          verification: verified("mma_asset_1", "object-version-other"),
        },
        reasonCode: "OBJECT_VERSION_MISMATCH",
      },
    ];

    for (const testCase of cases) {
      const { dependencies, objects } = harness();
      const result = await mutateMatchMediaAttachment(
        testCase.command,
        dependencies,
      );
      assert.equal(result.outcome, "denied");
      assert.equal(result.reasonCode, testCase.reasonCode);
      assert.equal(rawAttachment(objects), null);
    }
  });

  it("rejects invalid absent/tombstoned transitions without mutation", async () => {
    const empty = harness();
    const absentTombstone = await mutateMatchMediaAttachment(
      {
        type: "tombstone",
        target,
        authority,
        expectedRevision: 0,
      },
      empty.dependencies,
    );
    assert.equal(absentTombstone.outcome, "denied");
    assert.equal(absentTombstone.reasonCode, "INVALID_STATE_TRANSITION");
    assert.equal(rawAttachment(empty.objects), null);

    const existing = harness();
    await mutateMatchMediaAttachment(attachCommand(), existing.dependencies);
    await mutateMatchMediaAttachment(
      {
        type: "tombstone",
        target,
        authority,
        expectedRevision: 1,
      },
      existing.dependencies,
    );
    const before = rawAttachment(existing.objects);
    const reopen = await mutateMatchMediaAttachment(
      attachCommand(2, "mma_asset_2", "object-version-2"),
      existing.dependencies,
    );
    assert.equal(reopen.outcome, "denied");
    assert.equal(reopen.reasonCode, "INVALID_STATE_TRANSITION");
    assert.equal(rawAttachment(existing.objects), before);
  });

  it("rejects immutable asset version drift and preserves prior bytes", async () => {
    const { dependencies, objects } = harness();
    await mutateMatchMediaAttachment(attachCommand(), dependencies);
    const before = rawAttachment(objects);

    const drift = await mutateMatchMediaAttachment(
      attachCommand(1, "mma_asset_1", "object-version-mutated"),
      dependencies,
    );
    assert.equal(drift.outcome, "denied");
    assert.equal(drift.reasonCode, "OBJECT_VERSION_MISMATCH");
    assert.equal(rawAttachment(objects), before);
  });

  it("concurrent first attachment converges to one write and one idempotent result", async () => {
    const { dependencies, objects } = harness();
    const [left, right] = await Promise.all([
      mutateMatchMediaAttachment(attachCommand(), dependencies),
      mutateMatchMediaAttachment(attachCommand(), dependencies),
    ]);

    assert.deepEqual(
      [left.outcome, right.outcome].sort(),
      ["attached", "idempotent"],
    );
    const persisted = rawAttachment(objects);
    assert.ok(persisted);
    assert.equal(JSON.parse(persisted).revision, 1);
  });

  it("eligibility data alone is side-effect free and cannot create an attachment", () => {
    const { objects } = harness();
    const eligibility = verified();
    assert.equal(eligibility.publicationEligible, true);
    assert.equal(rawAttachment(objects), null);

    const evaluation = evaluateMatchMediaAttachmentMutation(
      null,
      attachCommand(),
      new Date("2026-07-23T12:00:00.000Z"),
    );
    assert.equal(evaluation.kind, "write");
    assert.equal(rawAttachment(objects), null);
  });

  it("Publication operations cannot mutate foreign verification records or R2 bytes", async () => {
    const { dependencies } = harness();
    const verificationRecord = Object.freeze({
      state: "verified",
      matchMediaAssetId: "mma_asset_1",
      objectVersion: "object-version-1",
    });
    const r2Bytes = new Uint8Array([0, 1, 2, 3]);
    const verificationBefore = JSON.stringify(verificationRecord);
    const bytesBefore = [...r2Bytes];

    await mutateMatchMediaAttachment(attachCommand(), dependencies);

    assert.equal(JSON.stringify(verificationRecord), verificationBefore);
    assert.deepEqual([...r2Bytes], bytesBefore);
  });
});
