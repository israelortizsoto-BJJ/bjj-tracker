export type ParentVerifiedCompletionReplayPrerequisiteIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  uploadSessionId: string;
  matchMediaAssetId: string;
  objectVersion: string;
};

export type ParentVerifiedCompletionReplayPrerequisiteRecord = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  uploadSessionId: string;
  matchMediaAssetId: string;
  objectVersion: string;
  status: string;
  localSourceUri: string;
};

export type ParentVerifiedCompletionReplayPrerequisiteChecks = {
  recordExists: boolean;
  uploadComplete: boolean;
  associationMatches: boolean;
  uploadSessionIdMatches: boolean;
  matchMediaAssetIdMatches: boolean;
  objectVersionMatches: boolean;
  localSourceUriPresent: boolean;
  localParentWriterCredentialsAvailable: boolean;
  liveParentAuthorityAndTopologyUnverified: true;
};

export type ParentVerifiedCompletionReplayPrerequisiteResult = {
  outcome:
    | "inspection_blocked"
    | "record_missing"
    | "prerequisites_not_met"
    | "ready_for_separately_authorized_device_inspection";
  reason?: "not_development" | "incomplete_explicit_identity";
  checks: ParentVerifiedCompletionReplayPrerequisiteChecks;
};

export type ParentVerifiedCompletionReplayPrerequisiteDependencies = {
  isDevelopment: () => boolean;
  loadRecord: (input: Pick<
    ParentVerifiedCompletionReplayPrerequisiteIdentity,
    "sharedAthleteId" | "sharedCompetitionId" | "matchLineageKey"
  >) => Promise<ParentVerifiedCompletionReplayPrerequisiteRecord | null>;
  hasLocalParentWriterCredentials: () => Promise<boolean>;
};

function required(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyChecks(): ParentVerifiedCompletionReplayPrerequisiteChecks {
  return {
    recordExists: false,
    uploadComplete: false,
    associationMatches: false,
    uploadSessionIdMatches: false,
    matchMediaAssetIdMatches: false,
    objectVersionMatches: false,
    localSourceUriPresent: false,
    localParentWriterCredentialsAvailable: false,
    liveParentAuthorityAndTopologyUnverified: true,
  };
}

/**
 * DEV-only local read. It never resolves a session, calls a Worker route, or returns a URI/token/secret.
 */
export async function inspectParentVerifiedCompletionReplayPrerequisites(
  input: ParentVerifiedCompletionReplayPrerequisiteIdentity,
  dependencies: ParentVerifiedCompletionReplayPrerequisiteDependencies,
): Promise<ParentVerifiedCompletionReplayPrerequisiteResult> {
  const checks = emptyChecks();
  if (!dependencies.isDevelopment()) {
    return { outcome: "inspection_blocked", reason: "not_development", checks };
  }

  const identity = {
    sharedAthleteId: required(input.sharedAthleteId),
    sharedCompetitionId: required(input.sharedCompetitionId),
    matchLineageKey: required(input.matchLineageKey),
    uploadSessionId: required(input.uploadSessionId),
    matchMediaAssetId: required(input.matchMediaAssetId),
    objectVersion: required(input.objectVersion),
  };
  if (Object.values(identity).some((value) => !value)) {
    return { outcome: "inspection_blocked", reason: "incomplete_explicit_identity", checks };
  }

  const [record, localParentWriterCredentialsAvailable] = await Promise.all([
    dependencies.loadRecord(identity),
    dependencies.hasLocalParentWriterCredentials(),
  ]);
  checks.localParentWriterCredentialsAvailable = localParentWriterCredentialsAvailable;
  if (!record) return { outcome: "record_missing", checks };

  checks.recordExists = true;
  checks.uploadComplete = record.status === "upload_complete";
  checks.associationMatches =
    record.sharedAthleteId === identity.sharedAthleteId &&
    record.sharedCompetitionId === identity.sharedCompetitionId &&
    record.matchLineageKey === identity.matchLineageKey;
  checks.uploadSessionIdMatches = record.uploadSessionId === identity.uploadSessionId;
  checks.matchMediaAssetIdMatches = record.matchMediaAssetId === identity.matchMediaAssetId;
  checks.objectVersionMatches = record.objectVersion === identity.objectVersion;
  checks.localSourceUriPresent = Boolean(required(record.localSourceUri));

  const ready =
    checks.uploadComplete &&
    checks.associationMatches &&
    checks.uploadSessionIdMatches &&
    checks.matchMediaAssetIdMatches &&
    checks.objectVersionMatches &&
    checks.localSourceUriPresent &&
    checks.localParentWriterCredentialsAvailable;
  return { outcome: ready ? "ready_for_separately_authorized_device_inspection" : "prerequisites_not_met", checks };
}
