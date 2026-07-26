export type ParentVerifiedCompletionReplayIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
};

export type PersistedUploadCompleteRecord = ParentVerifiedCompletionReplayIdentity & {
  status: "upload_complete";
  localSourceUri: string;
  uploadSessionId: string;
  matchMediaAssetId: string;
  objectVersion: string;
};

export type ParentVerifiedCompletionReplayResult =
  | { outcome: "replay_blocked"; reason: string }
  | { outcome: "record_missing" }
  | { outcome: "record_invalid"; reason: string }
  | { outcome: "replay_failed"; message: string }
  | { outcome: "replay_unverified"; traceId: string }
  | {
      outcome: "replay_verified";
      traceId: string;
      publication: "skipped" | "attempted_succeeded" | "attempted_failed";
      publicationMessage?: string;
    };

export type ParentVerifiedCompletionReplayDependencies = {
  isDevelopment: () => boolean;
  replayEnabled: () => boolean;
  loadRecord: (identity: ParentVerifiedCompletionReplayIdentity) => Promise<PersistedUploadCompleteRecord | null>;
  replay: (input: ParentVerifiedCompletionReplayIdentity & {
    localUri: string;
    replayVerifiedCompletion: true;
    traceTrigger: "verified_completion_replay";
    traceId: string;
  }) => Promise<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    message?: string;
    result?: { serverReportedVerified?: boolean };
    publication?: { outcome: string; message?: string };
  }>;
  createTraceId: () => string;
};

/** Process-local only: prevents overlapping explicit replays across DEV route remounts. */
const inFlightLineageKeys = new Set<string>();

export type SynchronousReplayAttemptRef = { current: boolean };

/** Atomically acquires a caller-owned synchronous guard, e.g. a React ref. */
export function tryAcquireSynchronousReplayAttempt(ref: SynchronousReplayAttemptRef): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

export function releaseSynchronousReplayAttempt(ref: SynchronousReplayAttemptRef): void {
  ref.current = false;
}

function required(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function lineageMutexKey(identity: ParentVerifiedCompletionReplayIdentity): string {
  return `${identity.sharedAthleteId}\u0000${identity.sharedCompetitionId}\u0000${identity.matchLineageKey}`;
}

function validRecord(
  record: PersistedUploadCompleteRecord,
  identity: ParentVerifiedCompletionReplayIdentity,
): string | null {
  if (record.status !== "upload_complete") return "record is not upload_complete";
  if (
    record.sharedAthleteId !== identity.sharedAthleteId ||
    record.sharedCompetitionId !== identity.sharedCompetitionId ||
    record.matchLineageKey !== identity.matchLineageKey
  ) return "record identity does not match the explicitly requested lineage";
  if (!required(record.localSourceUri) || !required(record.uploadSessionId) || !required(record.matchMediaAssetId) || !required(record.objectVersion)) {
    return "record is missing immutable completion identity or local source";
  }
  return null;
}

/** One explicit, DEV-gated replay; never scans records or retries automatically. */
export async function runOneParentVerifiedCompletionReplay(
  input: ParentVerifiedCompletionReplayIdentity,
  dependencies: ParentVerifiedCompletionReplayDependencies,
): Promise<ParentVerifiedCompletionReplayResult> {
  if (!dependencies.isDevelopment()) return { outcome: "replay_blocked", reason: "not_development" };
  if (!dependencies.replayEnabled()) return { outcome: "replay_blocked", reason: "replay_flag_off" };
  const identity = {
    sharedAthleteId: required(input.sharedAthleteId),
    sharedCompetitionId: required(input.sharedCompetitionId),
    matchLineageKey: required(input.matchLineageKey),
  };
  if (!identity.sharedAthleteId || !identity.sharedCompetitionId || !identity.matchLineageKey) {
    return { outcome: "record_invalid", reason: "explicit athlete, competition, and match lineage are required" };
  }
  const mutexKey = lineageMutexKey(identity);
  if (inFlightLineageKeys.has(mutexKey)) {
    return { outcome: "replay_blocked", reason: "replay_already_in_flight" };
  }
  inFlightLineageKeys.add(mutexKey);
  try {
    const record = await dependencies.loadRecord(identity);
    if (!record) return { outcome: "record_missing" };
    const recordProblem = validRecord(record, identity);
    if (recordProblem) return { outcome: "record_invalid", reason: recordProblem };

    const traceId = dependencies.createTraceId();
    const result = await dependencies.replay({
      localUri: record.localSourceUri,
      sharedAthleteId: record.sharedAthleteId,
      sharedCompetitionId: record.sharedCompetitionId,
      matchLineageKey: record.matchLineageKey,
      replayVerifiedCompletion: true,
      traceTrigger: "verified_completion_replay",
      traceId,
    });
    if (!result.ok) {
      if (result.skipped) return { outcome: "replay_blocked", reason: result.reason ?? "replay_skipped" };
      return { outcome: "replay_failed", message: result.message ?? "Completion replay failed." };
    }
    if (!result.result?.serverReportedVerified) return { outcome: "replay_unverified", traceId };
    if (!result.publication) return { outcome: "replay_verified", traceId, publication: "skipped" };
    if (result.publication.outcome === "failed") {
      return { outcome: "replay_verified", traceId, publication: "attempted_failed", publicationMessage: result.publication.message };
    }
    return { outcome: "replay_verified", traceId, publication: "attempted_succeeded" };
  } catch (error) {
    return { outcome: "replay_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    inFlightLineageKeys.delete(mutexKey);
  }
}
