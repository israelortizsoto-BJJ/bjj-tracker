import {
  sharedMatchMediaPublicationClientEnabled,
  sharedMatchMediaUploadClientEnabled,
} from "../../config/sharedMatchMediaUploadFlags";
import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import {
  uploadParentSharedMatchMediaVideo,
  type SharedMatchMediaUploadCompleteResult,
  type SharedMatchMediaUploadDependencies,
} from "../../services/sharedMatchMediaUploadApi";
import {
  publishParentMatchMediaAttachment,
  type ParentMatchMediaPublicationDependencies,
  type ParentMatchMediaPublicationResult,
} from "../../services/sharedMatchMediaPublicationApi";
import {
  getSharedMatchMediaUploadRecord,
  putSharedMatchMediaUploadComplete,
  type SharedMatchMediaUploadRecord,
} from "../../storage/sharedMatchMediaUploadStore";
import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";

export type ParentSharedMatchMediaUploadOutcome =
  | {
      ok: true;
      skipped?: undefined;
      result: SharedMatchMediaUploadCompleteResult;
      record: SharedMatchMediaUploadRecord;
      publication?: ParentMatchMediaPublicationResult | { outcome: "failed"; message: string };
    }
  | {
      ok: false;
      skipped: true;
      reason:
        | "client_flag_off"
        | "missing_associations"
        | "http_or_remote_uri"
        | "no_parent_writer_target"
        | "already_upload_complete";
      message: string;
    }
  | {
      ok: false;
      skipped?: false;
      reason: "upload_failed";
      message: string;
    };

function logUpload(stage: string, payload: Record<string, unknown>): void {
  console.log("[SHARED_MATCH_MEDIA_UPLOAD]", { stage, ...payload });
}

export type ParentSharedMatchMediaUploadRequest = {
  localUri: string | null | undefined;
  sharedAthleteId: string | null | undefined;
  sharedCompetitionId: string | null | undefined;
  matchLineageKey: string | null | undefined;
  /** Trace-only correlation; never sent to the Worker or persisted. */
  traceId?: string | null;
  traceTrigger?: "selection" | "post_save";
  force?: boolean;
  dependencies?: Partial<SharedMatchMediaUploadDependencies>;
  publicationDependencies?: Partial<ParentMatchMediaPublicationDependencies>;
};

/**
 * Parent-selected local match video → authenticated Shared Match Media foundation →
 * transport-safe multipart → upload_complete with immutable asset identity + object version.
 *
 * Does not verify, publish, resolve, or change playback/transcript systems.
 */
export async function uploadParentSelectedSharedMatchMedia(
  input: ParentSharedMatchMediaUploadRequest,
): Promise<ParentSharedMatchMediaUploadOutcome> {
  const sharedAthleteId =
    typeof input.sharedAthleteId === "string" ? input.sharedAthleteId.trim() : "";
  const sharedCompetitionId =
    typeof input.sharedCompetitionId === "string" ? input.sharedCompetitionId.trim() : "";
  const matchLineageKey =
    typeof input.matchLineageKey === "string" ? input.matchLineageKey.trim() : "";
  const traceId = input.traceId?.trim() || `parent-match-media-${Date.now().toString(36)}`;
  const traceIdentity = {
    traceId,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    matchLineageKey: matchLineageKey || null,
    trigger: input.traceTrigger ?? "selection",
  };
  logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_REQUESTED", {
    ...traceIdentity,
    hasLocalSource: Boolean(typeof input.localUri === "string" && input.localUri.trim()),
  });
  if (!sharedMatchMediaUploadClientEnabled && !input.force) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "client_flag_off",
    });
    return {
      ok: false,
      skipped: true,
      reason: "client_flag_off",
      message: "Shared Match Media upload client flag is off.",
    };
  }

  const localUri = typeof input.localUri === "string" ? input.localUri.trim() : "";
  if (!localUri) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "missing_associations",
    });
    return {
      ok: false,
      skipped: true,
      reason: "missing_associations",
      message: "No local match video selected.",
    };
  }
  if (/^https?:\/\//i.test(localUri)) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "http_or_remote_uri",
    });
    return {
      ok: false,
      skipped: true,
      reason: "http_or_remote_uri",
      message: "Remote video links are not Shared Match Media uploads.",
    };
  }
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "missing_associations",
    });
    return {
      ok: false,
      skipped: true,
      reason: "missing_associations",
      message:
        "Shared Match Media upload requires linked athlete, competition, and match identity.",
    };
  }

  const existing = await getSharedMatchMediaUploadRecord({
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
  });
  if (
    existing?.status === "upload_complete" &&
    existing.localSourceUri === localUri &&
    existing.matchMediaAssetId &&
    existing.objectVersion
  ) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "already_upload_complete",
      matchMediaAssetId: existing.matchMediaAssetId,
    });
    logUpload("already_upload_complete", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId: existing.matchMediaAssetId,
    });
    return {
      ok: false,
      skipped: true,
      reason: "already_upload_complete",
      message: "Match video already reached upload_complete for this local source.",
    };
  }

  const target = await resolveLinkedTargetForParentWriter(sharedAthleteId);
  if (!target) {
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_SKIPPED", {
      ...traceIdentity,
      reason: "no_parent_writer_target",
    });
    return {
      ok: false,
      skipped: true,
      reason: "no_parent_writer_target",
      message: "No Parent writer session is available for Shared Match Media upload.",
    };
  }

  logUpload("UPLOAD_BEGIN", {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    hasLocalUri: true,
  });

  try {
    const result = await uploadParentSharedMatchMediaVideo({
      linkToken: target.linkToken,
      parentWriterSecret: target.parentWriterSecret,
      localUri,
      associations: { sharedAthleteId, sharedCompetitionId, matchLineageKey },
      apiBaseUrlOverride: target.apiBaseUrl,
      dependencies: input.dependencies,
    });

    // Only persist after explicit upload_complete with identity + object version.
    const record = await putSharedMatchMediaUploadComplete({
      sharedAthleteId: result.sharedAthleteId,
      sharedCompetitionId: result.sharedCompetitionId,
      matchLineageKey: result.matchLineageKey,
      matchMediaAssetId: result.matchMediaAssetId,
      objectVersion: result.objectVersion,
      uploadSessionId: result.uploadSessionId,
      completedByteCount: result.completedByteCount,
      completedAt: result.completedAt,
      declaredMimeType: result.declaredMimeType,
      declaredByteCount: result.declaredByteCount,
      localSourceUri: result.localSourceUri,
    });

    let publication:
      | ParentMatchMediaPublicationResult
      | { outcome: "failed"; message: string }
      | undefined;
    if (result.serverReportedVerified && sharedMatchMediaPublicationClientEnabled) {
      try {
        publication = await publishParentMatchMediaAttachment({
          linkToken: target.linkToken,
          parentWriterSecret: target.parentWriterSecret,
          sharedAthleteId: record.sharedAthleteId,
          sharedCompetitionId: record.sharedCompetitionId,
          matchLineageKey: record.matchLineageKey,
          matchMediaAssetId: record.matchMediaAssetId,
          objectVersion: record.objectVersion,
          expectedRevision: 0,
          apiBaseUrlOverride: target.apiBaseUrl,
          dependencies: input.publicationDependencies,
        });
      } catch (error) {
        publication = {
          outcome: "failed",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    logUpload("UPLOAD_COMPLETE", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId: record.matchMediaAssetId,
      objectVersion: record.objectVersion,
      status: record.status,
      verification: false,
      publication: publication?.outcome ?? false,
    });
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_RESULT", {
      ...traceIdentity,
      uploadComplete: true,
      serverReportedVerified: result.serverReportedVerified,
      publicationOutcome: publication?.outcome ?? null,
      matchMediaAssetId: record.matchMediaAssetId,
    });

    return { ok: true, result, record, ...(publication ? { publication } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logUpload("UPLOAD_FAILED", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      error: message,
    });
    logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_PUBLICATION_RESULT", {
      ...traceIdentity,
      uploadComplete: false,
      error: message,
    });
    return {
      ok: false,
      reason: "upload_failed",
      message,
    };
  }
}

/**
 * Fire-and-forget Parent video selection → upload client entry.
 * Failures are visible via onFailure; never records false completion.
 */
export function scheduleUploadParentSelectedSharedMatchMedia(
  input: ParentSharedMatchMediaUploadRequest,
  hooks?: {
    onFailure?: (message: string) => void;
    onComplete?: (record: SharedMatchMediaUploadRecord) => void;
  },
): void {
  const traceId = input.traceId?.trim() || `parent-match-media-${Date.now().toString(36)}`;
  logCoachMediaCorridorTrace("PARENT_MATCH_MEDIA_SCHEDULED", {
    traceId,
    sharedAthleteId: input.sharedAthleteId?.trim() || null,
    sharedCompetitionId: input.sharedCompetitionId?.trim() || null,
    matchLineageKey: input.matchLineageKey?.trim() || null,
    trigger: input.traceTrigger ?? "selection",
  });
  void (async () => {
    const outcome = await uploadParentSelectedSharedMatchMedia({ ...input, traceId });
    if (outcome.ok) {
      hooks?.onComplete?.(outcome.record);
      return;
    }
    if (outcome.skipped) {
      logUpload("UPLOAD_SKIPPED", {
        reason: outcome.reason,
        message: outcome.message,
      });
      return;
    }
    hooks?.onFailure?.(outcome.message);
  })();
}
