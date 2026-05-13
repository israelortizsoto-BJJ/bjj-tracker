import {
  deleteParentKidCompetitionEntry,
  resolveLinkedTargetForParentWriter,
  type ParentKidCompetitionDeleteOutcome,
} from "../../family/parentKidCompetitionDelete";
import { medalTierFromKidResult } from "../../types/coachKid";
import { getKidsById } from "../../storage/coachKidStore";
import { setCompetitionDetailForEntryId } from "../../storage/competitionStore";
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
  return deleteParentKidCompetitionEntry(input.entryId, input.kidId, getKidsById);
}

async function createCompetitionFamily(input: FamilyCreateCompetitionInput): Promise<CreateCompetitionResult> {
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
      setFamilyPhase("resolve_miss_abort_no_post");
      return { ok: false, blocked: { kind: "resolve_miss_new" } };
    }
    assertDevWritableTarget(target);
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
          ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
      );
      setFamilyPhase("post_coachSyncCreateSessionCompetition_ok");
      console.log("[COMP_SYNC_TRACE] familyCompetitionEditScreen onSave", {
        stage: "coachSyncCreateSessionCompetition_resolved",
        elapsedMs: Date.now() - saveT0,
        remoteCompetitionId: remote.competition?.id ?? null,
        mounted: mounted(),
      });
      const createdRow = await createKidCompetitionEntry({
        kidId,
        sharedAthleteId: linkedAthleteId,
        sharedCompetitionId: remote.competition.id,
        tournamentName: name,
        eventDate,
        ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
        medal: medalTierFromKidResult(resultDraft),
        medalImageUri: medalImageDraft,
        status: eventStatusDraft,
        eventStatus: eventStatusDraft,
        organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
        format: formatDraft,
      });
      return { ok: true, savedCompetitionId: createdRow.id };
    } catch (e) {
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
    ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
    medal: medalTierFromKidResult(resultDraft),
    medalImageUri: medalImageDraft,
    status: eventStatusDraft,
    eventStatus: eventStatusDraft,
    organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
    format: formatDraft,
  });
  return { ok: true, savedCompetitionId: createdRow.id };
}

async function createCompetitionKid(input: KidCreateCompetitionInput): Promise<CreateCompetitionResult> {
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
      return { ok: false, blocked: { kind: "resolve_miss_new" } };
    }
    assertDevWritableTarget(target);
    try {
      const remote = await coachSyncCreateSessionCompetition(
        target.linkToken,
        target.parentWriterSecret,
        {
          sharedAthleteId: trimmedResolved,
          tournamentName: name,
          eventDate,
          result: resultDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim() ? promoterDraft.trim() : undefined,
          format: formatDraft,
        },
        target.apiBaseUrl,
      );
      const created = await createKidCompetitionEntry({
        kidId,
        sharedAthleteId: trimmedResolved,
        sharedCompetitionId: remote.competition.id,
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
        ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
      });
      await setCompetitionDetailForEntryId(created.id, { matches: matchSnapshots });
      console.log("[COMPETITION_SAVE]", {
        competitionId: created.id,
        sharedAthleteId: trimmedResolved ?? null,
        actorRole: "parent",
      });
      return { ok: true, savedCompetitionId: created.id };
    } catch (e) {
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  const created = await createKidCompetitionEntry({
    kidId,
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
    ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
  });
  await setCompetitionDetailForEntryId(created.id, { matches: matchSnapshots });
  console.log("[COMPETITION_SAVE]", {
    competitionId: created.id,
    sharedAthleteId: trimmedResolved ?? null,
    actorRole: "parent",
  });
  return { ok: true, savedCompetitionId: created.id };
}

async function updateCompetitionFamily(input: FamilyUpdateCompetitionInput): Promise<UpdateCompetitionResult> {
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

  if (athleteForRemote && workerCompetitionId) {
    const target = await resolveLinkedTargetForParentWriter(athleteForRemote, workerCompetitionId);
    if (!target) {
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
      );
    } catch (e) {
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  await updateKidCompetitionEntry(entryId, {
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
  return { ok: true, savedCompetitionId: entryId };
}

async function updateCompetitionKid(input: KidUpdateCompetitionInput): Promise<UpdateCompetitionResult> {
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
      );
    } catch (e) {
      return { ok: false, blocked: { kind: "sync_api", message: toOpErrorMessage(e) || "Try again shortly." } };
    }
  }

  await updateKidCompetitionEntry(entryId, {
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
  await setCompetitionDetailForEntryId(entryId, { matches: matchSnapshots });
  console.log("[COMPETITION_SAVE]", {
    competitionId: entryId,
    sharedAthleteId: trimmedResolved ?? null,
    actorRole: "parent",
  });
  return { ok: true, savedCompetitionId: entryId };
}
