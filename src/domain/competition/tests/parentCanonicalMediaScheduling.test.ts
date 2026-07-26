import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const editor = read("app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx");
const sync = read("src/domain/competition/CompetitionSync.ts");
const topology = read("src/domain/competition/publishParentCompetitionTopology.ts");

describe("Parent canonical media scheduling corridor", () => {
  it("defers transient editor lineage and retries only from reloaded persisted detail", () => {
    assert.match(editor, /isStableMatchLineageKey\(match\.id\)/);
    assert.match(editor, /awaitTopologyPublication:\s*true/);
    assert.match(editor, /await getCompetitionDetailForEntry\(savedEntry\)/);
    assert.match(editor, /for \(const match of persistedDetail\.detail\.matches\)/);
  });

  it("requires the accepted topology receipt to contain the canonical match lineage", () => {
    assert.match(editor, /topologyPublication\?\.accepted/);
    assert.match(editor, /matchLineageKeysByCompetitionId\[postSaveSharedCompetitionId\]/);
    assert.match(editor, /acceptedMatchLineageKeys\.includes\(match\.id\)/);
  });

  it("keeps the existing wrapper while allowing the Parent save to await topology acceptance", () => {
    assert.match(topology, /export async function publishParentCompetitionTopology/);
    assert.match(topology, /export function schedulePublishParentCompetitionTopology/);
    assert.match(topology, /await coachSyncPutCompetitionTopology/);
    assert.match(sync, /if \(awaitTopologyPublication\)/);
    assert.match(sync, /await publishParentCompetitionTopology/);
  });

  it("maps only post-persistence topology failures to a non-accepted receipt", () => {
    assert.match(topology, /\| "publish_failed"/);
    assert.match(sync, /await setCompetitionDetailForEntry\(created, \{ matches: stabilizedMatchSnapshots \}\);[\s\S]*?try \{[\s\S]*?await publishParentCompetitionTopology/);
    assert.match(sync, /topology_publication_failed_after_persistence/);
    assert.match(sync, /topologyPublication = \{ accepted: false, reason: "publish_failed" \}/);
  });

  it("retains create success and its saved ID after a topology partial success", () => {
    assert.match(sync, /return \{ ok: true, savedCompetitionId: created\.id, topologyPublication \}/);
    const createAfterPersistence = sync.slice(sync.indexOf("let topologyPublication"));
    assert.match(
      createAfterPersistence,
      /try \{[\s\S]*?await publishParentCompetitionTopology[\s\S]*?catch \(error\)[\s\S]*?publish_failed[\s\S]*?completeParentCompetitionMutation[\s\S]*?return \{ ok: true, savedCompetitionId: created\.id, topologyPublication \}/,
    );
    assert.match(editor, /savedCompetitionId = created\.savedCompetitionId/);
    assert.match(editor, /exitEditor\([\s\S]*?competitionId: savedCompetitionId/s);
  });

  it("retains update success and completes its transition after a topology partial success", () => {
    assert.match(sync, /topology_publication_failed_after_persistence[\s\S]*?completeParentCompetitionMutation/s);
    assert.match(sync, /return \{ ok: true, savedCompetitionId: entryId, topologyPublication \}/);
  });

  it("keeps media local unless the accepted receipt includes the exact canonical lineage", () => {
    assert.match(editor, /topologyPublication\?\.accepted/);
    assert.match(editor, /acceptedMatchLineageKeys\.includes\(match\.id\)/);
    assert.match(editor, /topologyPublication\?\.reason === "publish_failed"/);
    const postSaveMediaScheduling = editor.slice(editor.indexOf("const acceptedMatchLineageKeys"));
    assert.doesNotMatch(postSaveMediaScheduling, /videoUri\s*[:=]\s*(undefined|null)/);
  });

  it("records each post-save scheduling decision before continuing or scheduling", () => {
    assert.match(editor, /PARENT_MATCH_MEDIA_POST_SAVE_EVALUATED/);
    assert.match(editor, /if \(!__DEV__\) return;/);
    assert.match(editor, /persistedDetailPresent/);
    assert.match(editor, /postSaveScopePresent/);
    assert.match(editor, /topologyAccepted/);
    assert.match(editor, /stableLineage/);
    assert.match(editor, /acceptedLineage/);
    assert.match(editor, /hasLocalSource/);
    assert.match(editor, /remoteUri/);
    assert.match(editor, /willSchedule/);
    assert.match(
      editor,
      /missing_persisted_detail[\s\S]*?missing_post_save_scope[\s\S]*?topology_not_accepted[\s\S]*?unstable_lineage[\s\S]*?accepted_lineage_absent[\s\S]*?missing_local_source[\s\S]*?remote_source[\s\S]*?eligible/,
    );
    assert.match(
      editor,
      /tracePostSaveMediaDecision\(traceId, match\.id,[\s\S]*?if \(!willSchedule[\s\S]*?scheduleUploadParentSelectedSharedMatchMedia/s,
    );
  });

  it("keeps remote source values out of the decision trace", () => {
    const decisionStart = editor.indexOf("const tracePostSaveMediaDecision");
    const decisionTrace = editor.slice(
      decisionStart,
      editor.indexOf("if (!persistedDetail?.detail)", decisionStart),
    );
    assert.match(decisionTrace, /remoteUri: boolean;/);
    assert.doesNotMatch(decisionTrace, /localUri,/);
    assert.doesNotMatch(decisionTrace, /videoUri,/);
  });

  it("does not mislabel intentional non-accepted receipts as a failed save", () => {
    assert.match(
      editor,
      /topologyPublication\?\.reason === "publish_failed"[\s\S]*?Competition saved/s,
    );
    assert.doesNotMatch(editor, /reason === "topology_publish_flag_off"[\s\S]*?Competition saved/s);
    assert.doesNotMatch(editor, /reason === "no_linked_target"[\s\S]*?Competition saved/s);
  });
});
