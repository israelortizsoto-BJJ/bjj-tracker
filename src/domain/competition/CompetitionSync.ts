import {
  deleteParentKidCompetitionEntry,
  resolveLinkedTargetForParentWriter,
  type ParentKidCompetitionDeleteOutcome,
} from "../../family/parentKidCompetitionDelete";
import {
  beginCompetitionTransition,
  endCompetitionTransition,
} from "../../competition-state-auditor/competitionTransitionContext";
import { scheduleParentCanonicalSnapshot } from "../../competition-state-auditor/emitParentCanonicalSnapshot";
import { medalTierFromKidResult } from "../../types/coachKid";
import { competitionResultPersistFields } from "./competitionResultDraft";
import { getKidsById } from "../../storage/coachKidStore";
import {
  setCompetitionDetailForEntry,
  setCompetitionDetailForEntryId,
} from "../../storage/competitionStore";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSessionCompetition,
  coachSyncUpdateSessionCompetition,
} from "../../services/coachWeeklySyncApi";
import {
  createKidCompetitionEntry,
  getKidCompetitionEntryById,
  updateKidCompetitionEntry,
} from "../../storage/kidCompetitionStore";
import {
  logCompDelete,
  logCompPublishGuard,
  logCompSave,
} from "../../dev/competitionMutationDevLog";
import { schedulePublishParentCompetitionAggregate } from "./publishParentCompetitionAggregate";
import { schedulePublishParentCompetitionTopology } from "./publishParentCompetitionTopology";
import { stabilizeCompetitionMatchLineageBeforePersist } from "./stabilizeCompetitionMatchLineage";
import { athleteIdForFamilyRemoteUpdate, rosterSharedAthleteId, workerCompetitionIdForEntry } from "./CompetitionSelectors";
import {
  competitionFamilySaveTrace,
  type CreateCompetitionResult,
  type DeleteCompetitionInput,
  type FamilyCreateCompetitionInput,
  type FamilyUpdateCompetitionInput,
  type KidCreateCompetitionInput,
  type KidUpdateCompetitionInput,
  type UpdateCompetitionResult,
} from "./CompetitionTypes";

function toOpErrorMessage(e: unknown): string {
  if (e instanceof CoachWeeklySyncApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Try again shortly.";
}

function setFamilyPhase(phase: string) {
  competitionFamilySaveTrace.phase = phase;
}

function assertDevKidLinkedRemoteInvariant(opts: {
  rosterShared: string | undefined;
  resolvedShared: string | undefined;
  willAttemptRemote: boolean;
  surface: string;
}) {
  if (!__DEV__) return;
  const roster = opts.rosterShared?.trim();
  if (!roster) return;
  if (!opts.willAttemptRemote) {
    console.error(
      "[CompetitionSync DEV] linked athlete on roster but remote sync skipped",
      { surface: opts.surface, rosterShared: roster, resolvedShared: opts.resolvedShared ?? null },
    );
    throw new Error("[CompetitionSync DEV] linked athlete but remote sync skipped");
  }
  if (!opts.resolvedShared?.trim()) {
    console.error("[CompetitionSync DEV] missing sharedAthleteId on linked flow", {
      surface: opts.surface,
      rosterShared: roster,
    });
    throw new Error("[CompetitionSync DEV] missing sharedAthleteId on linked flow");
  }
}

function assertDevWritableTarget(target: { linkToken: string; parentWriterSecret: string } | null) {
  if (!__DEV__ || !target) return;
  if (!target.parentWriterSecret?.trim()) {
    console.error("[CompetitionSync DEV] missing writable token during linked parent flow", {
      linkTokenTail: target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
    });
    throw new Error("[CompetitionSync DEV] missing parentWriterSecret on resolved linked target");
  }
}

function completeParentCompetitionMutation(input: {
  sharedAthleteId: string | null | undefined;
  transitionId: string;
}): void {
  const sharedAthleteId = input.sharedAthleteId?.trim();
  if (sharedAthleteId) {
    if (__DEV__) {
      console.log("[COMP_AUDITOR_S1] S1_GATE_REACHED", {
        transitionId: input.transitionId,
        sharedAthleteId,
      });
    }
    scheduleParentCanonicalSnapshot({
      sharedAthleteId,
      transitionId: input.transitionId,
    });
  }
  endCompetitionTransition(input.transitionId);
}

function scheduleCompetitionAggregatePublishAfterMutation(input: {
  mutationType: "create" | "edit" | "delete";
  sharedAthleteId: string | null | undefined;
  sharedCompetitionId?: string | null;
  triggerReason: string;
  transitionId?: string;
}): void {
  const sharedAthleteId = input.sharedAthleteId?.trim() ?? "";
  if (!sharedAthleteId) {
    if (__DEV__) {
      console.log("[COMP_AGGREGATE_PUBLISH_TRIGGER_TRACE]", {
        mutationType: input.mutationType,
        sharedAthleteId: null,
        sharedCompetitionId: input.sharedCompetitionId ?? null,
        triggerReason: input.triggerReason,
        aggregatePublishScheduled: false,
        skipReason: "missing_sharedAthleteId",
      });
    }
    return;
  }

  console.log("[COMP_AGGREGATE_PUBLISH_TRIGGER_TRACE]", {
    mutationType: input.mutationType,
    sharedAthleteId,
    sharedCompetitionId: input.sharedCompetitionId ?? null,
    triggerReason: input.triggerReason,
    aggregatePublishScheduled: true,
  });
  schedulePublishParentCompetitionAggregate(sharedAthleteId, input.transitionId);
}

export async function createCompetition(
  input: FamilyCreateCompetitionInput | KidCreateCompetitionInput,
): Promise<CreateCompetitionResult> {
  if (input.surface === "family") {
    return createCompetitionFamily(input);
  }
  return createCompetitionKid(input);
}

export async function updateCompetition(
  input: FamilyUpdateCompetitionInput | KidUpdateCompetitionInput,
): Promise<UpdateCompetitionResult> {
  if (input.surface === "family") {
    return updateCompetitionFamily(input);
  }
  return updateCompetitionKid(input);
}

export async function deleteCompetition(
  input: DeleteCompetitionInput,
): Promise<ParentKidCompetitionDeleteOutcome> {
  logCompDelete("BEGIN", {
    competitionId: input.entryId,
    athleteId: input.kidId,
    localStoreAffected: "kidCompetitionStore+competitionDetailStore",
    operationKind: "optimistic",
    surface: "CompetitionSync.deleteCompetition",
  });
  try {
    const outcome = await deleteParentKidCompetitionEntry(input.entryId, input.kidId, getKidsById);
    if (outcome.ok) {
      logCompDelete("COMPLETE", {
        competitionId: input.entryId,
        athleteId: input.kidId,
        operationKind: "local",
        surface: "CompetitionSync.deleteCompetition",
      });
    } else {
      logCompDelete("ERROR", {
        competitionId: input.entryId,
        athleteId: input.kidId,
        operationKind: "server",
        surface: "CompetitionSync.deleteCompetition",
        error: outcome.alertMessage,
        phaseDetail: "blocked_before_local_delete",
      });
    }
    return outcome;
  } catch (e) {
    logCompDelete("ERROR", {
      competitionId: input.entryId,
      athleteId: input.kidId,
      operationKind: "local",
      surface: "CompetitionSync.deleteCompetition",
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

async function createCompetitionFamily(input: FamilyCreateCompetitionInput): Promise<CreateCompetitionResult> {
  logCompSave("BEGIN", {
    athleteId: input.kidId,
    operationKind: "optimistic",
    surface: "CompetitionSync.createCompetitionFamily",
    localStoreAffected: "kidCompetitionStore",
  });
  const {
    kidId,
    tournamentName: name,
    eventDate,
    resultDraft,
    eventStatusDraft,
    formatDraft,
    promoterDraft,
    medalImageDraft,
    trace,
  } = input;
  const saveT0 = trace?.saveT0 ?? Date.now();
  const mounted = trace?.mounted ?? (() => true);

  setFamilyPhase("save_started");
  console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
    stage: "save_started",
    tMs: saveT0,
    isNew: true,
    kidId,
    mounted: mounted(),
  });

  const kids = await getKidsById();
  const kid = kids[kidId];
  const linkedAthleteId = kid?.sharedAthleteId?.trim();
  console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
    stage: "after_getKidsById",
    elapsedMs: Date.now() - saveT0,
    linkedAthleteIdPresent: Boolean(linkedAthleteId),
    linkedAthleteId: linkedAthleteId || null,
    hasKidRow: Boolean(kid),
    willAttemptRemoteCreate: Boolean(linkedAthleteId && kid),
    mounted: mounted(),
  });

  if (linkedAthleteId && kid) {
    setFamilyPhase("resolve_linked_target");
    const target = await resolveLinkedTargetForParentWriter(
      linkedAthleteId,
      undefined,
      __DEV__ ? { kidLocalId: kidId, kidName: kid.name } : undefined,
    );
    console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
      stage: "after_resolveLinkedTarget",
      elapsedMs: Date.now() - saveT0,
      resolveHit: Boolean(target),
      linkTokenTail: target?.linkToken
        ? target.linkToken.length > 8
          ? target.linkToken.slice(-8)
          : target.linkToken
        : null,
      mounted: mounted(),
    });
    if (!target) {
      logCompPublishGuard({
        athleteId: kidId,
        sharedAthleteId: linkedAthleteId,
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionFamily",
        phaseDetail: "resolve_miss_new_abort_no_local_write",
      });
      setFamilyPhase("resolve_miss_abort_no_post");
      return { ok: false, blocked: { kind: "resolve_miss_new" } };
    }
    assertDevWritableTarget(target);
    const transitionId = beginCompetitionTransition(linkedAthleteId);
    try {
      setFamilyPhase("pre_coachSyncCreateSessionCompetition");
      console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
        stage: "calling_coachSyncCreateSessionCompetition",
        elapsedMs: Date.now() - saveT0,
        mounted: mounted(),
      });
      const remote = await coachSyncCreateSessionCompetition(
        target.linkToken,
        target.parentWriterSecret,
        {
          sharedAthleteId: linkedAthleteId,
          tournamentName: name,
          eventDate,
          ...competitionResultPersistFields(resultDraft),
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
        transitionId,
      );
      setFamilyPhase("post_coachSyncCreateSessionCompetition_ok");
      console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
        stage: "coachSyncCreateSessionCompetition_resolved",
        elapsedMs: Date.now() - saveT0,
        remoteCompetitionId: remote.competition?.id ?? null,
        mounted: mounted(),
      });
      logCompSave("LOCAL", {
        athleteId: kidId,
        sharedAthleteId: linkedAthleteId,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionFamily",
        phaseDetail: "post_remote_create_before_local_row",
        localStoreAffected: "kidCompetitionStore",
      });
      const createdRow = await createKidCompetitionEntry({
        kidId,
        sharedAthleteId: linkedAthleteId,
        sharedCompetitionId: remote.competition.id,
        tournamentName: name,
        eventDate,
        ...competitionResultPersistFields(resultDraft),
        medal: medalTierFromKidResult(resultDraft),
        medalImageUri: medalImageDraft,
        status: eventStatusDraft,
        eventStatus: eventStatusDraft,
        organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
        format: formatDraft,
      });
      logCompSave("PUBLISH", {
        competitionId: createdRow.id,
        athleteId: kidId,
        sharedAthleteId: linkedAthleteId,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "local",
        surface: "CompetitionSync.createCompetitionFamily",
        localStoreAffected: "kidCompetitionStore",
      });
      scheduleCompetitionAggregatePublishAfterMutation({
        mutationType: "create",
        sharedAthleteId: linkedAthleteId,
        sharedCompetitionId: remote.competition.id,
        triggerReason: "createCompetitionFamily_after_local_shell_persisted",
        transitionId,
      });
      schedulePublishParentCompetitionTopology(linkedAthleteId, transitionId);
      completeParentCompetitionMutation({
        sharedAthleteId: linkedAthleteId,
        transitionId,
      });
      logCompSave("COMPLETE", {
        competitionId: createdRow.id,
        athleteId: kidId,
        sharedAthleteId: linkedAthleteId,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "local",
        surface: "CompetitionSync.createCompetitionFamily",
      });
      return { ok: true, savedCompetitionId: createdRow.id };
    } catch (e) {
      endCompetitionTransition(transitionId);
      logCompSave("ERROR", {
        athleteId: kidId,
        sharedAthleteId: linkedAthleteId,
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionFamily",
        error: toOpErrorMessage(e),
        phaseDetail: "coachSyncCreateSessionCompetition",
      });
      setFamilyPhase("post_coachSyncCreateSessionCompetition_caught");
      console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
        stage: "coachSyncCreateSessionCompetition_catch",
        elapsedMs: Date.now() - saveT0,
        error: e instanceof Error ? e.message : String(e),
        coachWeeklySyncStatus: e instanceof CoachWeeklySyncApiError ? e.status : null,
        mounted: mounted(),
      });
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  setFamilyPhase("local_only_new_no_linked_athlete_or_kid");
  console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
    stage: "skipped_coachSyncCreateSessionCompetition_local_only_new",
    elapsedMs: Date.now() - saveT0,
    reason: !kid ? "missing_kid_row" : !linkedAthleteId ? "missing_sharedAthleteId_on_kid" : "unexpected",
    mounted: mounted(),
  });
  const createdRow = await createKidCompetitionEntry({
    kidId,
    tournamentName: name,
    eventDate,
    ...competitionResultPersistFields(resultDraft),
    medal: medalTierFromKidResult(resultDraft),
    medalImageUri: medalImageDraft,
    status: eventStatusDraft,
    eventStatus: eventStatusDraft,
    organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
    format: formatDraft,
  });
  logCompSave("COMPLETE", {
    competitionId: createdRow.id,
    athleteId: kidId,
    operationKind: "local",
    surface: "CompetitionSync.createCompetitionFamily",
    phaseDetail: "local_only_new",
    localStoreAffected: "kidCompetitionStore",
  });
  return { ok: true, savedCompetitionId: createdRow.id };
}

async function createCompetitionKid(input: KidCreateCompetitionInput): Promise<CreateCompetitionResult> {
  logCompSave("BEGIN", {
    athleteId: input.kidId,
    sharedAthleteId: input.resolvedSharedAthleteId ?? null,
    operationKind: "optimistic",
    surface: "CompetitionSync.createCompetitionKid",
    overlayCount: input.matchSnapshots.length,
  });
  const {
    kidId,
    resolvedSharedAthleteId,
    tournamentName: name,
    eventDate,
    resultDraft,
    eventStatusDraft,
    formatDraft,
    promoterDraft,
    medalImageDraft,
    coachNotes,
    competitionVideos,
    matchSnapshots,
  } = input;

  const kids = await getKidsById();
  const kid = kids[kidId];
  const rosterShared = rosterSharedAthleteId(kids, kidId);
  const trimmedResolved = resolvedSharedAthleteId?.trim();
  const willAttemptRemote = Boolean(trimmedResolved);
  assertDevKidLinkedRemoteInvariant({
    rosterShared,
    resolvedShared: trimmedResolved,
    willAttemptRemote,
    surface: "kid_create",
  });

  if (trimmedResolved) {
    const devCreate =
      __DEV__ && kid
        ? { kidLocalId: kidId, kidName: kid.name }
        : undefined;
    const target = await resolveLinkedTargetForParentWriter(trimmedResolved, undefined, devCreate);
    if (!target) {
      logCompPublishGuard({
        athleteId: kidId,
        sharedAthleteId: trimmedResolved,
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionKid",
        phaseDetail: "resolve_miss_new",
      });
      return { ok: false, blocked: { kind: "resolve_miss_new" } };
    }
    assertDevWritableTarget(target);
    const transitionId = beginCompetitionTransition(trimmedResolved);
    try {
      const remote = await coachSyncCreateSessionCompetition(
        target.linkToken,
        target.parentWriterSecret,
        {
          sharedAthleteId: trimmedResolved,
          tournamentName: name,
          eventDate,
          ...competitionResultPersistFields(resultDraft),
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
        transitionId,
      );
      logCompSave("LOCAL", {
        athleteId: kidId,
        sharedAthleteId: trimmedResolved,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionKid",
        phaseDetail: "post_remote_create",
        overlayCount: matchSnapshots.length,
        localStoreAffected: "kidCompetitionStore+competitionDetailStore",
      });
      const created = await createKidCompetitionEntry({
        kidId,
        sharedAthleteId: trimmedResolved,
        sharedCompetitionId: remote.competition.id,
        tournamentName: name,
        eventDate,
        ...competitionResultPersistFields(resultDraft),
        medal: medalTierFromKidResult(resultDraft),
        medalImageUri: medalImageDraft,
        status: eventStatusDraft,
        eventStatus: eventStatusDraft,
        organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
        format: formatDraft,
        coachNotes: coachNotes.trim() ? coachNotes.trim() : undefined,
        ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
      });
      const stabilizedMatchSnapshots = await stabilizeCompetitionMatchLineageBeforePersist({
        entryId: created.id,
        sharedAthleteId: trimmedResolved,
        sharedCompetitionId: remote.competition.id,
        matches: matchSnapshots,
        source: "CompetitionSync.createCompetitionKid.linked",
      });
      await setCompetitionDetailForEntry(created, { matches: stabilizedMatchSnapshots });
      logCompSave("PUBLISH", {
        competitionId: created.id,
        athleteId: kidId,
        sharedAthleteId: trimmedResolved,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "local",
        surface: "CompetitionSync.createCompetitionKid",
      });
      scheduleCompetitionAggregatePublishAfterMutation({
        mutationType: "create",
        sharedAthleteId: trimmedResolved,
        sharedCompetitionId: remote.competition.id,
        triggerReason: "createCompetitionKid_after_detail_persisted",
        transitionId,
      });
      schedulePublishParentCompetitionTopology(trimmedResolved, transitionId);
      completeParentCompetitionMutation({
        sharedAthleteId: trimmedResolved,
        transitionId,
      });
      logCompSave("COMPLETE", {
        competitionId: created.id,
        athleteId: kidId,
        sharedAthleteId: trimmedResolved,
        canonicalPayloadIds: [remote.competition.id],
        operationKind: "local",
        surface: "CompetitionSync.createCompetitionKid",
      });
      console.log("[COMPETITION_SAVE]", {
        competitionId: created.id,
        sharedAthleteId: trimmedResolved ?? null,
        actorRole: "parent",
      });
      return { ok: true, savedCompetitionId: created.id };
    } catch (e) {
      endCompetitionTransition(transitionId);
      logCompSave("ERROR", {
        athleteId: kidId,
        sharedAthleteId: trimmedResolved,
        operationKind: "server",
        surface: "CompetitionSync.createCompetitionKid",
        error: toOpErrorMessage(e),
      });
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  const created = await createKidCompetitionEntry({
    kidId,
    tournamentName: name,
    eventDate,
    ...competitionResultPersistFields(resultDraft),
    medal: medalTierFromKidResult(resultDraft),
    medalImageUri: medalImageDraft,
    status: eventStatusDraft,
    eventStatus: eventStatusDraft,
    organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
    format: formatDraft,
    coachNotes: coachNotes.trim() ? coachNotes.trim() : undefined,
    ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
  });
  await setCompetitionDetailForEntry(created, { matches: matchSnapshots });
  logCompSave("LOCAL", {
    competitionId: created.id,
    athleteId: kidId,
    operationKind: "local",
    surface: "CompetitionSync.createCompetitionKid",
    phaseDetail: "local_only_new",
    overlayCount: matchSnapshots.length,
    localStoreAffected: "kidCompetitionStore+competitionDetailStore",
  });
  if (trimmedResolved) {
    logCompSave("PUBLISH", {
      competitionId: created.id,
      athleteId: kidId,
      sharedAthleteId: trimmedResolved,
      operationKind: "local",
      surface: "CompetitionSync.createCompetitionKid",
      phaseDetail: "local_only_but_has_resolved_shared",
    });
    const transitionId = beginCompetitionTransition(trimmedResolved);
    scheduleCompetitionAggregatePublishAfterMutation({
      mutationType: "create",
      sharedAthleteId: trimmedResolved,
      sharedCompetitionId: created.sharedCompetitionId ?? null,
      triggerReason: "createCompetitionKid_local_after_detail_persisted",
      transitionId,
    });
    schedulePublishParentCompetitionTopology(trimmedResolved, transitionId);
    completeParentCompetitionMutation({
      sharedAthleteId: trimmedResolved,
      transitionId,
    });
  }
  logCompSave("COMPLETE", {
    competitionId: created.id,
    athleteId: kidId,
    sharedAthleteId: trimmedResolved ?? null,
    operationKind: "local",
    surface: "CompetitionSync.createCompetitionKid",
    phaseDetail: "local_only_new",
  });
  console.log("[COMPETITION_SAVE]", {
    competitionId: created.id,
    sharedAthleteId: trimmedResolved ?? null,
    actorRole: "parent",
  });
  return { ok: true, savedCompetitionId: created.id };
}

async function updateCompetitionFamily(input: FamilyUpdateCompetitionInput): Promise<UpdateCompetitionResult> {
  logCompSave("BEGIN", {
    competitionId: input.entryId,
    athleteId: input.kidId,
    operationKind: "optimistic",
    surface: "CompetitionSync.updateCompetitionFamily",
  });
  const {
    kidId,
    entryId,
    tournamentName: name,
    eventDate,
    resultDraft,
    eventStatusDraft,
    formatDraft,
    promoterDraft,
    medalImageDraft,
    trace,
  } = input;
  const saveT0 = trace?.saveT0 ?? Date.now();
  const mounted = trace?.mounted ?? (() => true);
  const isNew = trace?.isNew ?? false;

  setFamilyPhase("save_started");
  console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
    stage: "save_started",
    tMs: saveT0,
    isNew,
    kidId,
    mounted: mounted(),
  });

  const kids = await getKidsById();
  const kid = kids[kidId];
  const linkedAthleteId = kid?.sharedAthleteId?.trim();
  console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
    stage: "after_getKidsById",
    elapsedMs: Date.now() - saveT0,
    linkedAthleteIdPresent: Boolean(linkedAthleteId),
    linkedAthleteId: linkedAthleteId || null,
    hasKidRow: Boolean(kid),
    willAttemptRemoteCreate: Boolean(isNew && linkedAthleteId && kid),
    mounted: mounted(),
  });

  const existing = await getKidCompetitionEntryById(entryId);
  const workerCompetitionId = workerCompetitionIdForEntry(existing);
  const athleteForRemote = athleteIdForFamilyRemoteUpdate(existing, kid?.sharedAthleteId?.trim());
  const transitionId = athleteForRemote
    ? beginCompetitionTransition(athleteForRemote)
    : null;

  if (athleteForRemote && workerCompetitionId) {
    const target = await resolveLinkedTargetForParentWriter(athleteForRemote, workerCompetitionId);
    if (!target) {
      logCompPublishGuard({
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionFamily",
        phaseDetail: "resolve_miss_edit",
      });
      return { ok: false, blocked: { kind: "resolve_miss_edit" } };
    }
    assertDevWritableTarget(target);
    try {
      await coachSyncUpdateSessionCompetition(
        target.linkToken,
        workerCompetitionId,
        target.parentWriterSecret,
        {
          tournamentName: name,
          eventDate,
          result: resultDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
        transitionId ? { transitionId, sharedAthleteId: athleteForRemote } : undefined,
      );
      logCompSave("LOCAL", {
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionFamily",
        phaseDetail: "remote_patch_ok",
      });
    } catch (e) {
      logCompSave("ERROR", {
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionFamily",
        error: toOpErrorMessage(e),
      });
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  const updatedEntry = await updateKidCompetitionEntry(entryId, {
    ...(athleteForRemote ? { sharedAthleteId: athleteForRemote } : {}),
    ...(workerCompetitionId ? { sharedCompetitionId: workerCompetitionId } : {}),
    tournamentName: name,
    eventDate,
    result: resultDraft,
    medal: medalTierFromKidResult(resultDraft),
    medalImageUri: medalImageDraft,
    status: eventStatusDraft,
    eventStatus: eventStatusDraft,
    organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
    format: formatDraft,
  });
  if (athleteForRemote) {
    logCompSave("PUBLISH", {
      competitionId: entryId,
      athleteId: kidId,
      sharedAthleteId: athleteForRemote,
      canonicalPayloadIds: workerCompetitionId ? [workerCompetitionId] : null,
      operationKind: "local",
      surface: "CompetitionSync.updateCompetitionFamily",
    });
    scheduleCompetitionAggregatePublishAfterMutation({
      mutationType: "edit",
      sharedAthleteId: athleteForRemote,
      sharedCompetitionId: workerCompetitionId ?? null,
      triggerReason: "updateCompetitionFamily_after_local_shell_persisted",
      transitionId: transitionId ?? undefined,
    });
    schedulePublishParentCompetitionTopology(athleteForRemote, transitionId ?? undefined);
    if (transitionId) {
      completeParentCompetitionMutation({
        sharedAthleteId: athleteForRemote,
        transitionId,
      });
    }
  }
  logCompSave("COMPLETE", {
    competitionId: entryId,
    athleteId: kidId,
    sharedAthleteId: athleteForRemote || null,
    canonicalPayloadIds: workerCompetitionId ? [workerCompetitionId] : null,
    operationKind: "local",
    surface: "CompetitionSync.updateCompetitionFamily",
    localStoreAffected: "kidCompetitionStore",
  });
  return { ok: true, savedCompetitionId: entryId };
}

async function updateCompetitionKid(input: KidUpdateCompetitionInput): Promise<UpdateCompetitionResult> {
  logCompSave("BEGIN", {
    competitionId: input.entryId,
    athleteId: input.kidId,
    sharedAthleteId: input.resolvedSharedAthleteId ?? null,
    operationKind: "optimistic",
    surface: "CompetitionSync.updateCompetitionKid",
    overlayCount: input.matchSnapshots.length,
  });
  const {
    kidId,
    entryId,
    resolvedSharedAthleteId,
    tournamentName: name,
    eventDate,
    resultDraft,
    eventStatusDraft,
    formatDraft,
    promoterDraft,
    medalImageDraft,
    coachNotes,
    competitionVideos,
    matchSnapshots,
  } = input;

  const kids = await getKidsById();
  const kid = kids[kidId];
  const existing = await getKidCompetitionEntryById(entryId);
  const workerCompetitionId = workerCompetitionIdForEntry(existing);
  const athleteForRemote = athleteIdForFamilyRemoteUpdate(existing, kid?.sharedAthleteId?.trim());
  const rosterShared = rosterSharedAthleteId(kids, kidId);
  const trimmedResolved = resolvedSharedAthleteId?.trim();
  const publishAthleteIdEarly = (trimmedResolved || athleteForRemote || "").trim();
  const transitionId = publishAthleteIdEarly
    ? beginCompetitionTransition(publishAthleteIdEarly)
    : null;
  if (__DEV__ && workerCompetitionId && !athleteForRemote.trim() && rosterShared) {
    console.error(
      "[CompetitionSync DEV] worker competition id present but no athlete for remote PUT while roster shows linked",
      { entryId, kidId, workerCompetitionId, rosterShared },
    );
    throw new Error("[CompetitionSync DEV] missing athlete id for linked remote update");
  }

  if (athleteForRemote && workerCompetitionId) {
    const target = await resolveLinkedTargetForParentWriter(athleteForRemote, workerCompetitionId);
    if (!target) {
      logCompPublishGuard({
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionKid",
        phaseDetail: "resolve_miss_edit",
      });
      return { ok: false, blocked: { kind: "resolve_miss_edit" } };
    }
    assertDevWritableTarget(target);
    try {
      await coachSyncUpdateSessionCompetition(
        target.linkToken,
        workerCompetitionId,
        target.parentWriterSecret,
        {
          tournamentName: name,
          eventDate,
          result: resultDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
        transitionId ? { transitionId, sharedAthleteId: athleteForRemote } : undefined,
      );
      logCompSave("LOCAL", {
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionKid",
        phaseDetail: "remote_patch_ok",
      });
    } catch (e) {
      logCompSave("ERROR", {
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: athleteForRemote,
        canonicalPayloadIds: [workerCompetitionId],
        operationKind: "server",
        surface: "CompetitionSync.updateCompetitionKid",
        error: toOpErrorMessage(e),
      });
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  const updatedEntry = await updateKidCompetitionEntry(entryId, {
    ...(trimmedResolved ? { sharedAthleteId: trimmedResolved } : {}),
    tournamentName: name,
    eventDate,
    result: resultDraft,
    medal: medalTierFromKidResult(resultDraft),
    medalImageUri: medalImageDraft,
    status: eventStatusDraft,
    eventStatus: eventStatusDraft,
    organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
    format: formatDraft,
    coachNotes: coachNotes.trim() ? coachNotes.trim() : undefined,
    competitionVideos,
  });
  const publishAthleteId = (trimmedResolved || athleteForRemote || "").trim();
  const detailMatchSnapshots =
    publishAthleteId && workerCompetitionId
      ? await stabilizeCompetitionMatchLineageBeforePersist({
          entryId,
          sharedAthleteId: publishAthleteId,
          sharedCompetitionId: workerCompetitionId,
          matches: matchSnapshots,
          source: "CompetitionSync.updateCompetitionKid.linked",
        })
      : matchSnapshots;
  const detailOwnerEntry = updatedEntry ?? existing;
  if (detailOwnerEntry) {
    await setCompetitionDetailForEntry(detailOwnerEntry, { matches: detailMatchSnapshots });
  } else {
    await setCompetitionDetailForEntryId(entryId, { matches: detailMatchSnapshots });
  }
  if (publishAthleteId) {
    logCompSave("PUBLISH", {
      competitionId: entryId,
      athleteId: kidId,
      sharedAthleteId: publishAthleteId,
      canonicalPayloadIds: workerCompetitionId ? [workerCompetitionId] : null,
      operationKind: "local",
      surface: "CompetitionSync.updateCompetitionKid",
      overlayCount: matchSnapshots.length,
    });
    scheduleCompetitionAggregatePublishAfterMutation({
      mutationType: "edit",
      sharedAthleteId: publishAthleteId,
      sharedCompetitionId: workerCompetitionId ?? null,
      triggerReason: "updateCompetitionKid_after_detail_persisted",
      transitionId: transitionId ?? undefined,
    });
    schedulePublishParentCompetitionTopology(publishAthleteId, transitionId ?? undefined);
    if (transitionId) {
      completeParentCompetitionMutation({
        sharedAthleteId: publishAthleteId,
        transitionId,
      });
    }
  }
  logCompSave("COMPLETE", {
    competitionId: entryId,
    athleteId: kidId,
    sharedAthleteId: trimmedResolved ?? athleteForRemote ?? null,
    canonicalPayloadIds: workerCompetitionId ? [workerCompetitionId] : null,
    operationKind: "local",
    surface: "CompetitionSync.updateCompetitionKid",
    overlayCount: matchSnapshots.length,
    localStoreAffected: "kidCompetitionStore+competitionDetailStore",
  });
  console.log("[COMPETITION_SAVE]", {
    competitionId: entryId,
    sharedAthleteId: trimmedResolved ?? null,
    actorRole: "parent",
  });
  return { ok: true, savedCompetitionId: entryId };
}
